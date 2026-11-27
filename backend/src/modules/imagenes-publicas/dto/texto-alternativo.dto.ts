import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class TextoAlternativoDto {
  @ApiProperty({ maxLength: 300, description: 'Qué muestra la imagen, para quien no la ve' })
  @IsString({ message: 'Describe la imagen en una frase' })
  @Matches(/\S/, { message: 'Describe la imagen en una frase' })
  @MaxLength(300, { message: 'La descripción de la imagen admite hasta 300 caracteres' })
  textoAlternativo: string;
}

/** Esquema Swagger del PUT multipart de imagen. */
export const ESQUEMA_SUBIR_IMAGEN = {
  schema: {
    type: 'object' as const,
    required: ['archivo', 'textoAlternativo'],
    properties: {
      archivo: { type: 'string' as const, format: 'binary', description: 'JPEG, PNG o WebP, hasta 15 MB' },
      textoAlternativo: { type: 'string' as const, maxLength: 300 },
    },
  },
};
