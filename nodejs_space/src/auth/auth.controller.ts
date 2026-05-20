import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Autenticación')
@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Registrar nuevo usuario (paciente)' })
  @ApiResponse({ status: 201, description: 'Registro exitoso' })
  @ApiResponse({ status: 400, description: 'Correo ya registrado' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('auth/me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Usuario actual' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }
}
