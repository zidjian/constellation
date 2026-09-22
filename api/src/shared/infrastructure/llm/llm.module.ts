import { Global, Module } from '@nestjs/common';
import { ClaudeStructured } from './claude-structured';

@Global()
@Module({ providers: [ClaudeStructured], exports: [ClaudeStructured] })
export class LlmModule {}
