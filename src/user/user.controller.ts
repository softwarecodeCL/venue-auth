import {
  Body, Controller, Get, Patch, Req, UseGuards, UsePipes,
  ValidationPipe, HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateMeDto } from './dto/update-me.dto';

@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async me(@Req() req: any) {
    return this.userService.getMe(req.user.id);
  }

  
  @Patch('me')
  @HttpCode(200)
  async updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    return this.userService.updateMe(req.user.id, dto);
  }


  @UseGuards(JwtAuthGuard)
  @Get('me/edit')
  async getMyEditableProfile(@Req() req: any) {
    // req.user.id viene de tu JwtStrategy.validate()
    return this.userService.getEditableProfile(req.user.id);
  }
}
