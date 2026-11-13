import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsString, Matches } from 'class-validator';

export class ConsultarIndicadoresQuery {
  @ApiProperty({ format: 'date', example: '2026-11-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  desde: string;

  @ApiProperty({ format: 'date', example: '2026-11-12' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  hasta: string;
}