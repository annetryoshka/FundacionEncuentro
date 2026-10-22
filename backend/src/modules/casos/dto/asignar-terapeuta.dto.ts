import { IsUUID } from 'class-validator';

export class AsignarTerapeutaDto {
  @IsUUID(undefined, { message: 'perfilId no es un id válido' })
  perfilId: string;
}
