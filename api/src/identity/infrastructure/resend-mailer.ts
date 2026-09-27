import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../../shared/infrastructure/config/config.module';
import type { Env } from '../../shared/infrastructure/config/env';
import type { Mailer } from '../domain/ports';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

/**
 * Correo por Resend con `fetch` (su SDK no aporta nada sobre un POST con JSON y añade dependencia).
 *
 * Sin `RESEND_API_KEY` no se manda nada: el enlace se escribe en el log. Así el flujo de
 * recuperación se puede probar en local y los e2e no dependen de la red.
 */
@Injectable()
export class ResendMailer implements Mailer {
  private readonly logger = new Logger(ResendMailer.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    return this.send(to, 'Restablece tu contraseña de Constellation', {
      titulo: 'Restablece tu contraseña',
      cuerpo:
        'Pediste volver a entrar en Constellation. Elige una contraseña nueva desde aquí:',
      boton: 'Elegir contraseña nueva',
      pie: 'Si no lo pediste, ignora este correo: tu contraseña sigue igual.',
      url: resetUrl,
    });
  }

  /** Va al correo **nuevo**: confirmarlo desde ahí es la prueba de que es suyo. */
  sendEmailChange(to: string, confirmUrl: string): Promise<void> {
    return this.send(to, 'Confirma tu correo en Constellation', {
      titulo: 'Confirma tu correo',
      cuerpo:
        'Pediste usar esta dirección en tu cuenta de Constellation. Confírmala aquí:',
      boton: 'Confirmar mi correo',
      pie: 'Si no lo pediste, ignora este correo: tu cuenta no cambia.',
      url: confirmUrl,
    });
  }

  private async send(to: string, asunto: string, texto: Correo): Promise<void> {
    if (!this.env.RESEND_API_KEY) {
      this.logger.warn(`Sin RESEND_API_KEY: enlace para ${to}: ${texto.url}`);
      return;
    }

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.env.MAIL_FROM,
        to: [to],
        subject: asunto,
        text: plainText(texto),
        html: html(texto),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // El detalle va al log; a quien lo pidió se le responde siempre lo mismo (no se filtra nada).
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Resend respondió ${res.status}: ${detail.slice(0, 200)}`,
      );
    }

    // El id permite rastrear el envío en el panel de Resend si alguien dice que no le llegó.
    const { id } = (await res.json().catch(() => ({}))) as { id?: string };
    this.logger.log(`Correo aceptado por Resend: ${id ?? 'sin id'}`);
  }
}

interface Correo {
  titulo: string;
  cuerpo: string;
  boton: string;
  pie: string;
  url: string;
}

const plainText = ({ titulo, cuerpo, pie, url }: Correo) => `${titulo}

${cuerpo}
${url}

El enlace caduca en 1 hora y solo sirve una vez.
${pie}`;

/** Tabla y estilos en línea: es lo único que los clientes de correo respetan de verdad. */
const html = ({ titulo, cuerpo, boton, pie, url }: Correo) => `<!doctype html>
<html lang="es"><body style="margin:0;background:#14171d;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
    <tr><td style="color:#f2f4f8;font-size:20px;font-weight:600;padding-bottom:16px">${titulo}</td></tr>
    <tr><td style="color:#b3bac6;font-size:15px;line-height:1.6;padding-bottom:24px">${cuerpo}</td></tr>
    <tr><td style="padding-bottom:24px">
      <a href="${url}" style="display:inline-block;background:#f5b14a;color:#14171d;font-size:15px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px">${boton}</a>
    </td></tr>
    <tr><td style="color:#8b93a1;font-size:13px;line-height:1.6">
      El enlace caduca en 1 hora y solo sirve una vez.<br>
      ${pie}
    </td></tr>
  </table>
</body></html>`;
