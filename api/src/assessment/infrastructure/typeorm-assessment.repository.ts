import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AssessmentSession,
  type AssessmentStatus,
} from '../domain/assessment-session';
import type { AssessmentRepository } from '../domain/ports';
import type { Answer, RecordedAnswer } from '../domain/questions';
import type { SkillProfile } from '../domain/skill-profile';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionRow = {
  id: string;
  user_id: string;
  status: AssessmentStatus;
  completed_at: Date | null;
};
type AnswerRow = { question_key: string; answer: Answer; score: number | null };

@Injectable()
export class TypeOrmAssessmentRepository implements AssessmentRepository {
  constructor(private readonly dataSource: DataSource) {}

  newId(): string {
    return randomUUID();
  }

  async findForUser(
    id: string,
    userId: string,
  ): Promise<AssessmentSession | null> {
    if (!UUID.test(id)) return null;
    // Ownership en la propia consulta: la sesión de otro usuario "no existe".
    const [row] = await this.dataSource.query<SessionRow[]>(
      `SELECT id, user_id, status, completed_at FROM assessment_sessions WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return row ? this.hydrate(row) : null;
  }

  async findInProgress(userId: string): Promise<AssessmentSession | null> {
    const [row] = await this.dataSource.query<SessionRow[]>(
      `SELECT id, user_id, status, completed_at FROM assessment_sessions
       WHERE user_id = $1 AND status = 'in_progress'`,
      [userId],
    );
    return row ? this.hydrate(row) : null;
  }

  async save(
    session: AssessmentSession,
    profile?: { profile: SkillProfile; interpretedBy: string },
  ): Promise<void> {
    const goal = session.answers.find((a) => a.questionKey === 'goal')?.answer;
    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO assessment_sessions (id, user_id, status, goal_text, completed_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, goal_text = EXCLUDED.goal_text,
           completed_at = EXCLUDED.completed_at, updated_at = now()`,
        [
          session.id,
          session.userId,
          session.status,
          goal && 'text' in goal ? goal.text : null,
          session.completedAt,
        ],
      );
      // Las respuestas solo se añaden (append-only): nunca se reescriben.
      for (const [position, a] of session.answers.entries()) {
        await tx.query(
          `INSERT INTO assessment_answers (session_id, position, question_key, answer, score)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [
            session.id,
            position,
            a.questionKey,
            JSON.stringify(a.answer),
            a.score,
          ],
        );
      }
      if (profile) {
        await tx.query(
          `INSERT INTO skill_profiles (session_id, levels, target_skills, interpreted_by) VALUES ($1, $2, $3, $4)`,
          [
            session.id,
            JSON.stringify(profile.profile.levels),
            profile.profile.targetSkills,
            profile.interpretedBy,
          ],
        );
      }
    });
  }

  async findProfile(
    sessionId: string,
  ): Promise<{ profile: SkillProfile; interpretedBy: string } | null> {
    const [row] = await this.dataSource.query<
      {
        levels: Record<string, number>;
        target_skills: string[];
        interpreted_by: string;
        goal_text: string | null;
      }[]
    >(
      `SELECT p.levels, p.target_skills, p.interpreted_by, s.goal_text
       FROM skill_profiles p JOIN assessment_sessions s ON s.id = p.session_id WHERE p.session_id = $1`,
      [sessionId],
    );
    if (!row) return null;
    return {
      profile: {
        levels: row.levels,
        targetSkills: row.target_skills,
        goal: row.goal_text ?? undefined,
      },
      interpretedBy: row.interpreted_by,
    };
  }

  private async hydrate(row: SessionRow): Promise<AssessmentSession> {
    const answers = await this.dataSource.query<AnswerRow[]>(
      `SELECT question_key, answer, score FROM assessment_answers WHERE session_id = $1 ORDER BY position`,
      [row.id],
    );
    return AssessmentSession.restore({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      completedAt: row.completed_at,
      answers: answers.map((a): RecordedAnswer => ({
        questionKey: a.question_key,
        answer: a.answer,
        score: a.score,
      })),
    });
  }
}
