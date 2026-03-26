import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateAdminDto } from '../users/dto/create-admin.dto';
import { Role } from 'src/common/enum/role.enum';

@Injectable()
export class AdminService {
  constructor(private readonly usersService: UsersService) {}

  async create(createAdminDto: CreateAdminDto) {
    return this.usersService.createAdmin(createAdminDto);
  }

  async findAll(query: any) {
    return this.usersService.findAll({ ...query, role: Role.ADMIN });
  }

  async findOne(id: string) {
    return this.usersService.getProfile(id);
  }

  async toggleStatus(id: string, requestingUserId: string) {
    return this.usersService.toggleUserStatus(id, requestingUserId);
  }

  async remove(id: string) {
    return this.usersService.deleteUser(id);
  }
}
