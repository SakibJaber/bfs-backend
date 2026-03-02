import { Injectable } from '@nestjs/common';
import { CreateSavedDto } from './dto/create-saved.dto';
import { UpdateSavedDto } from './dto/update-saved.dto';

@Injectable()
export class SavedService {
  create(createSavedDto: CreateSavedDto) {
    return 'This action adds a new saved';
  }

  findAll() {
    return `This action returns all saved`;
  }

  findOne(id: number) {
    return `This action returns a #${id} saved`;
  }

  update(id: number, updateSavedDto: UpdateSavedDto) {
    return `This action updates a #${id} saved`;
  }

  remove(id: number) {
    return `This action removes a #${id} saved`;
  }
}
