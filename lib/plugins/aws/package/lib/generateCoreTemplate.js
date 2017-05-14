'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');

const validateS3BucketName = require('../../lib/validateS3BucketName');

module.exports = {
  generateCoreTemplate() {
    _.assign(
      this,
      validateS3BucketName
    );

    this.serverless.service.provider
      .compiledCloudFormationTemplate = this.serverless.utils.readFileSync(
      path.join(this.serverless.config.serverlessPath,
        'plugins',
        'aws',
        'package',
        'lib',
        'core-cloudformation-template.json')
    );

    if (this.serverless.service.provider.deploymentBucket) {
      return BbPromise.bind(this)
        .then(() => this.provider.resolveExportValue(
          this.serverless.service.provider.deploymentBucket)
        )
        .then(bucketName => {
          this.bucketName = bucketName;
          return this.validateS3BucketName(bucketName);
        })
        .then(() => this.provider.request('S3',
          'getBucketLocation',
          {
            Bucket: this.bucketName,
          },
          this.options.stage,
          this.options.region
        ))
        .then(resultParam => {
          const result = resultParam;
          if (result.LocationConstraint === '') result.LocationConstraint = 'us-east-1';
          if (result.LocationConstraint === 'EU') result.LocationConstraint = 'eu-west-1';
          if (result.LocationConstraint !== this.options.region) {
            throw new this.serverless.classes.Error(
              'Deployment bucket is not in the same region as the lambda function'
            );
          }
          this.serverless.service.package.deploymentBucket = this.bucketName;
          this.serverless.service.provider.compiledCloudFormationTemplate
            .Outputs.ServerlessDeploymentBucketName.Value = this.bucketName;

          delete this.serverless.service.provider.compiledCloudFormationTemplate
            .Resources.ServerlessDeploymentBucket;
        });
    }

    if (this.serverless.service.provider.deploymentBucket) {
      return BbPromise.resolve();
    }

    const coreTemplateFileName = this.provider.naming.getCoreTemplateFileName();

    const coreTemplateFilePath = path.join(this.serverless.config.servicePath,
      '.serverless',
      coreTemplateFileName);

    this.serverless.utils.writeFileSync(coreTemplateFilePath,
      this.serverless.service.provider.compiledCloudFormationTemplate);

    this.serverless.service.provider.coreCloudFormationTemplate =
      _.cloneDeep(this.serverless.service.provider.compiledCloudFormationTemplate);

    return BbPromise.resolve();
  },

};
