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
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentUserId } from '../../identity/presentation/current-user.decorator';
import {
  RATE_LIMITS,
  UserThrottlerGuard,
} from '../../shared/presentation/user-throttler.guard';
import { AssessmentUseCases } from '../application/assessment.use-cases';
import { RecruiterUseCases } from '../application/recruiter.use-cases';

class RecruiterStartDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  jobOffer!: string;
}

class RecruiterReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  optionId?: string;
}

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
  constructor(
    private readonly assessments: AssessmentUseCases,
    private readonly recruiter: RecruiterUseCases,
  ) {}

  /** Qué modos ofrece el servidor: la web no muestra el simulacro si está apagado. */
  @Get('modes')
  modes() {
    return { recruiter: this.recruiter.available() };
  }

  /** Simulacro de entrevista con reclutador (modo opcional, requiere IA). */
  @Post('recruiter')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.recruiterStart })
  startRecruiter(
    @CurrentUserId() userId: string,
    @Body() dto: RecruiterStartDto,
  ) {
    return this.recruiter.start(userId, dto.jobOffer);
  }

  @Post(':id/recruiter/reply')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: RATE_LIMITS.recruiterReply })
  @HttpCode(200)
  replyRecruiter(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecruiterReplyDto,
  ) {
    return this.recruiter.reply(userId, id, dto);
  }

  /** Informe del simulacro, disponible tras completar. */
  @Get(':id/report')
  report(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assessments.report(userId, id);
  }

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
  @Throttle({ default: RATE_LIMITS.complete })
  @HttpCode(200)
  complete(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assessments.complete(userId, id);
  }
}
