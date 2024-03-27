import { FileUploadService } from '@nest-boot/file-upload';
import { Injectable } from '@nestjs/common';

import { CreateProductInput } from './inputs/create-product.input';
import { Product } from './objects/product.object';

@Injectable()
export class ProductService {
  private readonly products: Product[] = [];

  constructor(private readonly fileUploadService: FileUploadService) {}

  findAll(): Promise<Product[]> {
    return Promise.resolve(this.products);
  }

  async create(input: CreateProductInput): Promise<Product> {
    const imageUrl = await this.fileUploadService.persist(input.imageTmpUrl);

    const product = new Product();

    product.name = input.name;
    product.description = input.description;
    product.imageUrl = imageUrl;

    this.products.push(product);

    return product;
  }
}
