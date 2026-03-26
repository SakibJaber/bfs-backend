import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enum/role.enum';
import { AdminService } from './admin.service';
import { CreateAdminDto } from '../users/dto/create-admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async create(@Body() createAdminDto: CreateAdminDto) {
    const result = await this.adminService.create(createAdminDto);
    return {
      success: true,
      statusCode: 201,
      message: 'Admin created successfully',
      data: result,
    };
  }

  @Get()
  async findAll(@Query() query) {
    const result = await this.adminService.findAll(query);
    return {
      success: true,
      statusCode: 200,
      message: 'Admins fetched successfully',
      ...result,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.adminService.findOne(id);
    return {
      success: true,
      statusCode: 200,
      message: 'Admin fetched successfully',
      data: result,
    };
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string, @Req() req) {
    const result = await this.adminService.toggleStatus(id, req.user.userId);
    return {
      success: true,
      statusCode: 200,
      message: 'Admin status toggled successfully',
      data: result,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.adminService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: 'Admin deleted successfully',
      data: null,
    };
  }
}
