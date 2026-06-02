import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailVerificationService {
  private readonly TOKEN_EXPIRY_MINUTES = 60;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async sendVerificationLink(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email_verified_at) {
      throw new BadRequestException('Email already verified');
    }

    await this.prisma.emailVerification.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60000);

    await this.prisma.emailVerification.create({
      data: { user_id: user.id, token, expires_at: expiresAt },
    });

    const appUrl =
      this.config.get<string>('APP_URL') || 'http://localhost:3000';
    const link = `${appUrl}/auth/verify-email?token=${token}`;

    try {
      const brevoApiKey = this.config.get<string>('BREVO_API_KEY');
      if (!brevoApiKey) {
        throw new BadRequestException('BREVO_API_KEY is not configured');
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
      body: JSON.stringify({
          sender: {
            name: this.config.get<string>('MAIL_FROM_NAME') || 'Adherify',
            email: this.config.get<string>('MAIL_FROM_EMAIL'),
          },
          to: [{ email }],
          subject: 'Verifikasi Email Anda',
          htmlContent: `
            <p>Klik link berikut untuk verifikasi email Anda:</p>
            <a href="${link}">${link}</a>
            <p>Link berlaku selama ${this.TOKEN_EXPIRY_MINUTES} menit.</p>
          `,
        }),
    });
      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.message || 'Brevo API error');
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async verifyToken(token: string): Promise<void> {
    const verification = await this.prisma.emailVerification.findUnique({
      where: { token },
    });
    if (!verification || verification.used_at) {
      throw new BadRequestException('Invalid or already used verification link');
    }
    if (verification.expires_at < new Date()) {
      throw new BadRequestException('Verification link has expired');
    }
    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { used_at: new Date() },
      }),
      this.prisma.user.update({
        where: { id: verification.user_id },
        data: { email_verified_at: new Date() },
      }),
    ]);
  }
}