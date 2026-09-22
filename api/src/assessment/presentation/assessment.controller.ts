import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsObject, IsString, MaxLength } from 'class-validator';
import { CurrentUserId } from '../../identity/presentation/current-user.decorator';
import {
  RATE_LIMITS,
  UserThrottlerGuard,
} from '../../shared/presentation/user-throttler.guard';
import { AssessmentUseCases } from '../application/assessment.use-cases';

class AnswerDto {
  @IsString()
  @MaxLength(64)
  questionKey!: string;

  // La forma exacta depende de la pregunta: la valida el dominio (validateAnswer).
  @IsObject()
  answer!: Record<string, unknown>;
}

@Controller('assessments')
export class AssessmentController {
  constructor(private readonly assessments: AssessmentUseCases) {}

  @Post()
  start(@CurrentUserId() userId: string) {
    return this.assessments.start(userId);
  }

  @Get('current')
  current(@CurrentUserId() userId: string) {
    return this.assessments.current(userId);
  }

  @Post(':id/answers')
  @HttpCode(200)
  answer(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerDto,
  ) {
    return this.assessments.answer(userId, id, dto.questionKey, dto.answer);
  }

  // Completar dispara la interpretación con el LLM: se limita por usuario, como la generación.
  @Post(':id/complete')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ complete: RATE_LIMITS.complete })
  @HttpCode(200)
  complete(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assessments.complete(userId, id);
  }
}
