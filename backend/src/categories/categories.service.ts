import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active categories ordered by sortOrder. */
  findActive() {
    return this.prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        key: true,
        label: true,
        icon: true,
        accent: true,
        imageUrl: true,
        iconImageUrl: true,
        sortOrder: true,
      },
    });
  }
}
