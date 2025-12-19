import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import Translate from '@docusaurus/Translate';
import styles from './styles.module.css';

type FeatureItem = {
  title: ReactNode;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: <Translate id="homepage.features.modular.title">Modular Architecture</Translate>,
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <Translate id="homepage.features.modular.description">
        Pick and choose only the modules you need. Each module is independent and can be used separately.
      </Translate>
    ),
  },
  {
    title: <Translate id="homepage.features.typescript.title">TypeScript First</Translate>,
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <Translate id="homepage.features.typescript.description">
        Built with TypeScript for type safety and better developer experience with full IDE support.
      </Translate>
    ),
  },
  {
    title: <Translate id="homepage.features.production.title">Production Ready</Translate>,
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <Translate id="homepage.features.production.description">
        Battle-tested modules used in production applications. Reliable and well-maintained.
      </Translate>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
