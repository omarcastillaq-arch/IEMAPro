import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'usuario@ejemplo.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
