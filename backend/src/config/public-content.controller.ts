import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Public read access to admin-managed content (banners + CMS pages). */
@ApiTags('content')
@Controller()
export class PublicContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('banners')
  banners() {
    return this.prisma.banner.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, imageUrl: true, link: true },
    });
  }

  @Public()
  @Get('cms')
  cmsList() {
    return this.prisma.cmsPage.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
      select: { slug: true, title: true },
    });
  }

  @Public()
  @Get('cms/:slug')
  async cmsPage(@Param('slug') slug: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { slug, active: true },
      select: { slug: true, title: true, content: true, updatedAt: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }
}
