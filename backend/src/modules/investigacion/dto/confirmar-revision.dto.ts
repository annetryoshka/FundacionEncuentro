import { Matches } from 'class-validator';

export class ConfirmarRevisionDto {
  @Matches(/^[0-9a-f]{64}$/)
  huella: string;
}