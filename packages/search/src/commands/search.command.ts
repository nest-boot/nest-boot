/* eslint-disable no-console */

import { Command, Positional } from "@nest-boot/command";
import { Injectable } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";

import { SearchEngine } from "../engines/search.engine";
import { SearchableEntityRepository } from "../utils/mixin-searchable.util";

@Injectable()
export class SearchCommand {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly searchEngine: SearchEngine
  ) {}

  @Command({
    command: "search:index <index>",
    describe: "创建索引",
  })
  async createIndex(
    @Positional({
      name: "index",
      describe: "索引名称",
      type: "string",
    })
    index: string
  ): Promise<void> {
    const searchableEntityRepository =
      this.getSearchableEntityRepository(index);

    if (!searchableEntityRepository) {
      return;
    }

    const { searchableOptions } = searchableEntityRepository;

    await this.searchEngine.createIndex(index, searchableOptions);
  }

  @Command({
    command: "search:delete-index <index>",
    describe: "删除索引",
  })
  async deleteIndex(
    @Positional({
      name: "index",
      describe: "索引名称",
      type: "string",
    })
    index: string
  ): Promise<void> {
    const searchableEntityRepository =
      this.getSearchableEntityRepository(index);

    if (!searchableEntityRepository) {
      return;
    }

    await this.searchEngine.deleteIndex(index);
  }

  @Command({
    command: "search:import <index>",
    describe: "导入索引",
  })
  async import(
    @Positional({
      name: "index",
      describe: "索引名称",
      type: "string",
    })
    index: string
  ): Promise<void> {
    const searchableEntityRepository =
      this.getSearchableEntityRepository(index);

    if (!searchableEntityRepository) {
      return;
    }

    await searchableEntityRepository.searchable({});
  }

  @Command({
    command: "search:flush <index>",
    describe: "清空索引",
  })
  async flush(
    @Positional({
      name: "index",
      describe: "索引名称",
      type: "string",
    })
    index: string
  ): Promise<void> {
    const searchableEntityRepository =
      this.getSearchableEntityRepository(index);

    if (!searchableEntityRepository) {
      return;
    }

    await searchableEntityRepository.unsearchable({});
  }

  private getSearchableEntityRepository(
    index: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): SearchableEntityRepository<any> {
    return (
      this.discoveryService
        .getProviders()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .find((wrapper: InstanceWrapper<SearchableEntityRepository<any>>) => {
          return wrapper.instance?.searchableOptions?.index === index;
        })?.instance
    );
  }
}
