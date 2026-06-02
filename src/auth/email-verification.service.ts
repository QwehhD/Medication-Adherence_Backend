import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailVerificationService {
  private readonly TOKEN_EXPIRY_MINUTES = 60;
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: this.config.get<string>('MAIL_PASS'),
      },
    });
  }

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

    const appUrl = this.config.get<string>('APP_URL') || this.config.get<string>('APP_URL2') || 'http://localhost:3000';
    const link = `${appUrl}/auth/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM', `UKL App <${this.config.get('MAIL_USER')}>`),
      to: email,
      subject: 'Verifikasi Email Anda',
      html: `
        <p>Klik link berikut untuk verifikasi email Anda:</p>
        <a href="${link}">${link}</a>
        <p>Link berlaku selama ${this.TOKEN_EXPIRY_MINUTES} menit.</p>
      `,
    });
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
