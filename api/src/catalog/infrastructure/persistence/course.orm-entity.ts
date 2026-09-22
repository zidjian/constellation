import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('courses')
@Check(
  'courses_level_check',
  `level IN ('beginner', 'intermediate', 'advanced')`,
)
@Check('courses_duration_check', `duration_hours > 0`)
export class CourseOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Slug real de la URL de DevTalles: sensible a mayúsculas, puede llevar `_` y `%XX`.
  @Column({ type: 'varchar', length: 150, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500 })
  imageUrl!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'varchar', length: 20 })
  level!: string;

  @Column({
    name: 'duration_hours',
    type: 'numeric',
    precision: 5,
    scale: 1,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  durationHours!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
