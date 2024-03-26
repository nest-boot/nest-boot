import { CreateProductInput } from './inputs/create-product.input';
import { FileUploadService } from '@nest-boot/file-upload';
import { Product } from './objects/product.object';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductService {
  private readonly products: Product[] = [];

  constructor(private readonly fileUploadService: FileUploadService) {
    console.log('---', fileUploadService);
  }

  findAll(): Product[] {
    return this.products;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const imageUrl = await this.fileUploadService.tmpAssetToFileAsset(
      input.imageTmpUrl,
    );

    const product = new Product();

    product.name = input.name;
    product.description = input.description;
    product.imageUrl = imageUrl;

    this.products.push(product);

    return product;
  }
}
