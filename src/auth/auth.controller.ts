import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailVerification: EmailVerificationService,
  ) {}

  @ApiOperation({ summary: 'Register a new user (DOCTOR or PATIENT)' })
  @ApiResponse({ status: 201, description: 'User registered, verification email sent' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Login and receive JWT access token' })
  @ApiResponse({ status: 200, description: 'Returns access_token JWT' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Verify email via link' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.emailVerification.verifyToken(token);
    return { message: 'Email verified successfully' };
  }
}
