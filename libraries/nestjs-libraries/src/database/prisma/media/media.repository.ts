import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { OrganizeMediaDto } from '@gitroom/nestjs-libraries/dtos/media/organize.media.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MediaRepository {
  constructor(private _media: PrismaRepository<'media'>) {}

  saveFile(
    org: string,
    fileName: string,
    filePath: string,
    originalName?: string,
    brand?: string
  ) {
    return this._media.model.media.create({
      data: {
        organization: {
          connect: {
            id: org,
          },
        },
        name: fileName,
        path: filePath,
        originalName: originalName || null,
        brand: brand?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        brand: true,
        tags: true,
      },
    });
  }

  getMediaById(id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
      },
    });
  }

  deleteMedia(org: string, id: string) {
    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._media.model.media.update({
      where: {
        id: data.id,
        organizationId: org,
      },
      data: {
        alt: data.alt,
        thumbnail: data.thumbnail,
        thumbnailTimestamp: data.thumbnailTimestamp,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
        brand: true,
        tags: true,
      },
    });
  }

  organizeMedia(org: string, id: string, data: OrganizeMediaDto) {
    const tags = Array.from(
      new Set(data.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
    );

    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
      },
      data: {
        brand: data.brand?.trim() || null,
        tags,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        brand: true,
        tags: true,
      },
    });
  }

  async getMedia(
    org: string,
    page: number,
    search?: string,
    brand?: string,
    tag?: string
  ) {
    const pageNum = Math.max(0, Number(page || 1) - 1);
    const trimmedSearch = search?.trim();
    const trimmedTag = tag?.trim().toLowerCase();
    const where: Prisma.MediaWhereInput = {
      organizationId: org,
      deletedAt: null,
      ...(brand === '__unfiled__'
        ? { brand: null }
        : brand
        ? { brand: { equals: brand, mode: 'insensitive' } }
        : {}),
      ...(trimmedTag ? { tags: { has: trimmedTag } } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              {
                originalName: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
              {
                name: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
              { tags: { has: trimmedSearch.toLowerCase() } },
            ],
          }
        : {}),
    };
    const summaryWhere: Prisma.MediaWhereInput = {
      organizationId: org,
      deletedAt: null,
    };
    const [filteredCount, total, folderCounts, results] = await Promise.all([
      this._media.model.media.count({ where }),
      this._media.model.media.count({ where: summaryWhere }),
      this._media.model.media.groupBy({
        by: ['brand'],
        where: summaryWhere,
        _count: { _all: true },
      }),
      this._media.model.media.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          originalName: true,
          path: true,
          thumbnail: true,
          alt: true,
          thumbnailTimestamp: true,
          brand: true,
          tags: true,
          createdAt: true,
        },
        skip: pageNum * 18,
        take: 18,
      }),
    ]);
    const pages = Math.ceil(filteredCount / 18);

    return {
      pages,
      results,
      summary: {
        total,
        unfiled:
          folderCounts.find((folder) => folder.brand === null)?._count._all ||
          0,
        brands: folderCounts
          .filter((folder) => !!folder.brand)
          .map((folder) => ({
            name: folder.brand!,
            count: folder._count._all,
          })),
      },
    };
  }
}
