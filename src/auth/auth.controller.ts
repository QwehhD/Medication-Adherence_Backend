import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailVerification: EmailVerificationService,
  ) {}

  @ApiOperation({ summary: 'Get all doctors (for patient registration selection)' })
  @ApiResponse({ status: 200, description: 'List of doctors' })
  @Get('doctors')
  getDoctors() {
    return this.authService.getDoctors();
  }

  @ApiOperation({ summary: 'Register a new user (DOCTOR or PATIENT)' })
  @ApiResponse({ status: 201, description: 'User registered, verification email sent' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Patient self-registration with complete profile' })
  @ApiResponse({ status: 201, description: 'Patient registered with profile, verification email sent' })
  @Post('register-patient')
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
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

  @ApiOperation({ summary: 'Get Current User Profile (Protected)' })
  @ApiResponse({ status: 200, description: 'Current user profile data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.authService.getUserProfile(req.user.id);
  }
}