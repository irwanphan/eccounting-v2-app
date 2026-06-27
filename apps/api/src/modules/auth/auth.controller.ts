import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changePasswordRequestSchema,
  confirmPasswordResetSchema,
  loginRequestSchema,
  type LoginResponse,
  logoutRequestSchema,
  refreshRequestSchema,
  requestPasswordResetSchema,
  type ChangePasswordRequest,
  type ConfirmPasswordResetInput,
  type LoginRequest,
  type LogoutRequest,
  type RefreshRequest,
  type RequestPasswordResetInput,
} from '@eccounting/shared';
import type { FastifyRequest } from 'fastify';

import { CurrentUser, type AuthUserContext } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login dengan email + password' })
  @UsePipes(new ZodValidationPipe(loginRequestSchema))
  login(@Body() body: LoginRequest, @Req() req: FastifyRequest): Promise<LoginResponse> {
    return this.authService.login(body, this.extractMeta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tukar refresh token dengan access token baru (rotated)' })
  @UsePipes(new ZodValidationPipe(refreshRequestSchema))
  refresh(@Body() body: RefreshRequest, @Req() req: FastifyRequest): Promise<LoginResponse> {
    return this.authService.refresh(body.refreshToken, this.extractMeta(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout: revoke refresh token (atau semua device)' })
  @UsePipes(new ZodValidationPipe(logoutRequestSchema))
  async logout(@Body() body: LogoutRequest, @CurrentUser() user: AuthUserContext): Promise<void> {
    if (body.allDevices) {
      await this.authService.logoutAll(user.userId);
    } else if (body.refreshToken) {
      await this.authService.logout(body.refreshToken);
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ganti password (user yang sudah login)' })
  @UsePipes(new ZodValidationPipe(changePasswordRequestSchema))
  changePassword(
    @Body() body: ChangePasswordRequest,
    @CurrentUser() user: AuthUserContext,
  ): Promise<void> {
    return this.authService.changePassword(user.userId, body);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request reset password link via email',
    description: 'Selalu return 202 supaya tidak leak keberadaan email',
  })
  @UsePipes(new ZodValidationPipe(requestPasswordResetSchema))
  async forgotPassword(
    @Body() body: RequestPasswordResetInput,
    @Req() req: FastifyRequest,
  ): Promise<{ status: 'accepted' }> {
    await this.authService.requestPasswordReset(body.email, this.extractMeta(req).ipAddress);
    return { status: 'accepted' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Konfirmasi reset password dengan token dari email' })
  @UsePipes(new ZodValidationPipe(confirmPasswordResetSchema))
  resetPassword(@Body() body: ConfirmPasswordResetInput): Promise<void> {
    return this.authService.confirmPasswordReset(body);
  }

  private extractMeta(req: FastifyRequest): { userAgent?: string; ipAddress?: string } {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
