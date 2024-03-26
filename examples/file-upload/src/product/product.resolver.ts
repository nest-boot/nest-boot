import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CreateProductInput } from './inputs/create-product.input';
import { Product } from './objects/product.object';
import { ProductService } from './product.service';

@Resolver(() => Product)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => [Product])
  async getProducts(): Promise<Product[]> {
    return await this.productService.findAll();
  }

  @Mutation(() => Product)
  async createProduct(
    @Args({ type: () => CreateProductInput, name: 'input' })
    input: CreateProductInput,
  ): Promise<Product> {
    return await this.productService.create(input);
  }
}
