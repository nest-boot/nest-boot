import type { EntityManager } from "@mikro-orm/core";
import { Seeder } from "@mikro-orm/seeder";

import { Post } from "../../post/post.entity";
import { User } from "../../user/user.entity";

// {
//   id: faker.datatype.uuid(),
//   title: faker.lorem.paragraph(1),
//   content: faker.lorem.paragraph({ min: 1, max: 5 }),
//   createdAt: faker.date.anytime(),
//   updatedAt: faker.date.anytime()
// }
const posts = [
  {
    id: "ee818403-1a1f-41a0-9e23-3d11c9045795",
    title: "Voluptatibus rem mollitia suscipit.",
    content:
      "Aut ad eaque nobis expedita sequi provident. Ducimus temporibus quas recusandae consequatur.",
    createdAt: "2023-07-03T19:36:52.763Z",
    updatedAt: "2023-04-11T20:25:52.616Z",
  },
  {
    id: "9ad19a27-457a-4277-ab45-8fea9d585fa2",
    title: "Nemo eum modi vitae nulla voluptas aspernatur.",
    content:
      "Voluptatibus dolores similique. Sint dolores odio reprehenderit atque ab error sed. Porro placeat aliquid assumenda deserunt.",
    createdAt: "2023-07-11T20:39:48.011Z",
    updatedAt: "2023-12-23T07:41:27.410Z",
  },
  {
    id: "e0f82f89-9076-4a36-99c3-135795095d83",
    title: "Animi qui magni sed dolorem similique doloremque quae possimus.",
    content:
      "Ea inventore corporis similique corrupti similique nobis sapiente ipsam dicta. Odit at quibusdam amet nihil occaecati sed doloremque eius nobis. Delectus consequuntur mollitia nobis. Perspiciatis architecto minus quas accusantium corporis consectetur incidunt repellat. Velit tempora ex iste aliquid sapiente eius mollitia.",
    createdAt: "2024-03-08T02:48:43.345Z",
    updatedAt: "2023-10-26T20:30:47.169Z",
  },
  {
    id: "3d73dde9-fbb9-4df5-a592-4aa54e462b3d",
    title: "Nemo sunt ex nulla excepturi.",
    content: "Unde perferendis minima perferendis ipsum quae facere totam.",
    createdAt: "2023-11-08T15:48:59.560Z",
    updatedAt: "2024-05-24T04:43:17.247Z",
  },
  {
    id: "96fd54a0-3f58-4c97-abbc-77ae1a2f865a",
    title: "Molestiae atque ex consectetur modi itaque quis.",
    content:
      "Dolore error neque fugiat dolorum atque ut earum hic. Consectetur nisi modi incidunt aperiam vero corrupti odio. Provident quae sit earum excepturi. Non id distinctio consectetur dolorem minus perspiciatis illum corrupti nostrum.",
    createdAt: "2023-08-18T10:48:15.928Z",
    updatedAt: "2023-09-05T23:29:33.118Z",
  },
  {
    id: "d228d1b6-9a04-4499-8358-6344aa7dcbb9",
    title:
      "Possimus corporis dolorum ullam exercitationem minus delectus quasi.",
    content:
      "Tempore ipsam maiores consequatur ut iure autem. Totam temporibus molestias voluptatum recusandae.",
    createdAt: "2024-08-31T04:52:36.081Z",
    updatedAt: "2023-03-31T00:22:22.795Z",
  },
  {
    id: "20450417-34e8-4575-a550-c97c348ae0fe",
    title: "Omnis quisquam illum illum.",
    content:
      "Laborum adipisci incidunt tempore laborum. Illo explicabo iusto veritatis sit corporis. Dolorum laborum cum velit rem. Recusandae odit vitae hic aliquid asperiores repellat eaque nihil repellat.",
    createdAt: "2023-10-15T06:26:21.043Z",
    updatedAt: "2023-07-12T18:21:07.939Z",
  },
  {
    id: "30018a26-c279-4200-aeba-1a84629e0f6b",
    title: "Deserunt commodi id.",
    content:
      "Consequuntur quod explicabo similique. Dignissimos repellendus minus. Tenetur neque suscipit autem molestiae expedita sit atque. Nam reprehenderit tempora ab nobis. Consequuntur illum soluta.",
    createdAt: "2024-05-22T05:47:07.865Z",
    updatedAt: "2024-06-16T06:52:18.446Z",
  },
  {
    id: "5cee14ff-8888-47cc-9048-5c2d751693ce",
    title: "Dolor amet cupiditate at et mollitia.",
    content:
      "Quas eius quia atque repellendus dicta asperiores animi repellendus aspernatur. Architecto laboriosam aliquam corrupti asperiores nulla debitis explicabo aspernatur. Fugit ipsam corrupti dolores eum velit exercitationem animi eligendi rerum. Nihil rerum rerum ipsum commodi delectus dignissimos sunt.",
    createdAt: "2023-08-07T11:29:45.130Z",
    updatedAt: "2024-01-14T20:28:18.623Z",
  },
  {
    id: "047c1d6c-10b9-4e13-80c9-2ddf7369aa3d",
    title:
      "Dolorum perferendis earum officia ratione quam dolores voluptatem distinctio.",
    content:
      "Officiis saepe assumenda. Sint quaerat ut magnam ea similique nemo a asperiores. Nisi deleniti maxime qui minima laboriosam consectetur quidem maiores odit. Nisi impedit ex ut sapiente quasi reiciendis.",
    createdAt: "2024-02-22T06:38:19.751Z",
    updatedAt: "2023-11-15T12:26:12.183Z",
  },
];

export class DatabaseSeeder extends Seeder {
  // eslint-disable-next-line @typescript-eslint/require-await
  async run(em: EntityManager): Promise<void> {
    const user = em.create(User, {
      id: "b3c9b8b3-7c0e-4c8d-8c2a-6b3e5e5f9e0c",
      name: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const post of posts) {
      em.create(Post, {
        ...post,
        searchableContent: post.content,
        user,
        createdAt: new Date(post.createdAt),
        updatedAt: new Date(post.updatedAt),
      });
    }
  }
}
