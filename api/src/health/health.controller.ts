import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../identity/presentation/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'up' };
  }

  // Temporal (F0): verifica que el SSE llega incremental a través de Nginx. Se elimina en F3.
  @Get('stream')
  stream(@Res() res: Response): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    let sent = 0;
    const timer = setInterval(() => {
      sent += 1;
      res.write(
        `event: tick\ndata: ${JSON.stringify({ n: sent, at: new Date().toISOString() })}\n\n`,
      );
      if (sent === 5) {
        clearInterval(timer);
        res.write('event: done\ndata: {}\n\n');
        res.end();
      }
    }, 1000);
    res.on('close', () => clearInterval(timer));
  }
}
