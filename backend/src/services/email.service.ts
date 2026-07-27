import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "../utils/logger";

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private readonly transporter: Transporter;

  constructor() {
    const user = process.env.SMTP_USER;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      // Dev mail catchers (maildev, mailpit…) usually run without AUTH and reject the
      // session when credentials are offered, so only authenticate when configured.
      ...(user ? { auth: { user, pass: process.env.SMTP_PASSWORD } } : {}),
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!process.env.SMTP_HOST) {
      throw new Error("SMTP_HOST is not configured — cannot send email");
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      logger.error({ err: error }, "Error sending email:");
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info("SMTP connection verified successfully");
      return true;
    } catch (error) {
      logger.error({ err: error }, "SMTP connection verification failed:");
      return false;
    }
  }
}

export const emailService = new EmailService();
