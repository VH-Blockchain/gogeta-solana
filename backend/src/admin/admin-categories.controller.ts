import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  CreateCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  list() {
    return this.admin.listCategories();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.admin.createCategory(dto);
  }

  @Post('reorder')
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.admin.reorderCategories(dto.ids);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.admin.updateCategory(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }
}
