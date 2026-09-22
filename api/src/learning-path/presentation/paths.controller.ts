import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request, Response } from 'express';
import { CurrentUserId } from '../../identity/presentation/current-user.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { GeneratePathUseCase } from '../application/generate-path.use-case';
import { ManagePathsUseCases } from '../application/manage-paths.use-cases';
import { PATH_NAME_MAX } from '../domain/learning-path';
import { UserThrottlerGuard } from './user-throttler.guard';

class GeneratePathDto {
  @IsUUID()
  assessmentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(PATH_NAME_MAX)
  name!: string;
}

class UpdatePathDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(PATH_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export const GENERATE_LIMIT = { limit: 5, ttl: 60 * 60 * 1000 };

@Controller('paths')
export class PathsController {
  private readonly logger = new Logger(PathsController.name);

  constructor(
    private readonly generatePath: GeneratePathUseCase,
    private readonly paths: ManagePathsUseCases,
  ) {}

  /**
   * SSE sobre POST (EventSource no manda body): profile → step×N → rationale×N → done | error.
   * Los errores previos al stream (validación, 401, 404, 409, 429) salen como JSON normal.
   */
  @Post('generate')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ generate: GENERATE_LIMIT })
  async generate(
    @CurrentUserId() userId: string,
    @Body() dto: GeneratePathDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const plan = await this.generatePath.prepare(
      userId,
      dto.assessmentId,
      dto.name,
    );

    const abort = new AbortController();
    res.on('close', () => abort.abort());
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      for await (const e of this.generatePath.run(plan, abort.signal))
        send(e.event, e.data);
    } catch (err) {
      if (abort.signal.aborted) {
        this.logger.log(`Generación cancelada por el cliente (${req.ip})`);
        return;
      }
      this.logger.error(err);
      const safe =
        err instanceof DomainError
          ? { code: err.code, message: err.message }
          : {
              code: 'PATH_GENERATION_FAILED',
              message: 'No pudimos generar la ruta. Inténtalo de nuevo.',
            };
      send('error', safe);
    }
    res.end();
  }

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.paths.list(userId);
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.paths.get(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePathDto,
  ) {
    return this.paths.update(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paths.delete(userId, id);
  }

  @Put(':id/steps/:stepId/completion')
  complete(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.paths.setStepCompletion(userId, id, stepId, true);
  }

  @Delete(':id/steps/:stepId/completion')
  uncomplete(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.paths.setStepCompletion(userId, id, stepId, false);
  }
}
