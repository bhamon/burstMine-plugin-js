/*
	Burst mine
	Distributed graphical plotter and miner for Burst.
	Author: Cryo
	Bitcoin: 138gMBhCrNkbaiTCmUhP9HLU9xwn5QKZgD
	Burst: BURST-YA29-QCEW-QXC3-BKXDL
*/

var lib = {
	deps:{
		q:require('q'),
		joi:require('joi')
	},
	ErrorRest:require('../../../../ErrorRest'),
	constants:require('../../../../constants')
};

module.exports.parseParams = function(p_generation, p_params) {
	var result = lib.deps.joi.validate(p_params, {
		generatorPreset:lib.deps.joi.string().regex(/^[a-z0-9]{1,100}$/)
	}, {
		abortEarly:false,
		presence:'required'
	});

	if(result.error) {
		throw new lib.ErrorRest(409, 'validation', 'Invalid input parameters', result.error.details);
	}

	return result.value;
};

module.exports.generate = function(p_context, p_generation) {
	var resources = [];
	return lib.deps.q.all([
		p_generation.getPlots(p_context)
		.then(function(p_plotsArray) {
			return lib.deps.q.all(p_plotsArray.map(function(p_plots) {
				var plugin = p_context.plugins[p_plots.plugin];
				if(!plugin) {
					throw new lib.ErrorRest(404, 'plotsWrapper.plugin.notFound', 'Plots wrapper plugin not found');
				}

				var plotsWrapper = plugin.plotsWrappers[p_plots.type];
				if(!plotsWrapper) {
					throw new lib.ErrorRest(404, 'plotsWrapper.notFound', 'Plots wrapper not found');
				}

				return plotsWrapper.createWriter(p_context, p_plots)
				.then(function(p_writer) {
					resources.push(p_writer);
					return p_writer;
				});
			}));
		}),
		lib.deps.q.ninvoke(p_context.db, 'collection', 'generatorPreset')
		.then(function(p_dbCollectionGeneratorPreset) {
			return lib.deps.q.ninvoke(p_dbCollectionGeneratorPreset, 'findOne', {
				_id:new p_context.db.ObjectID(p_generation.params.generatorPreset)
			})
			.then(function(p_dbGeneratorPreset) {
				if(!p_dbGeneratorPreset) {
					throw new lib.ErrorRest(404, 'generatorPreset.notFound', 'Generator preset not found');
				}

				var plugin = p_context.plugins[p_dbGeneratorPreset.plugin];
				if(!plugin) {
					throw new lib.ErrorRest(404, 'generator.plugin.notFound', 'Generator plugin not found');
				}

				var generator = plugin.generators[p_dbGeneratorPreset.type];
				if(!generator) {
					throw new lib.ErrorRest(404, 'generator.notFound', 'Generator not found');
				}

				return generator.create(p_context, p_dbGeneratorPreset)
				.then(function(p_generator) {
					resources.push(p_generator);
					return p_generator;
				});
			});
		})
	])
	.spread(function(p_writers, p_generator) {
		var buffer = new Buffer(p_generator.maxWorkSize * lib.constants.PLOT_SIZE);
		return p_writers.reduce(function(p_p1, p_writer) {
			return p_p1.then(function() {
				var steps = [];
				for(var i = p_writer.plots.progress ; i < p_writer.plots.number ; i += p_generator.maxWorkSize) {
					steps.push({
						begin:i,
						size:Math.min(p_generator.maxWorkSize, p_writer.plots.number - i)
					});
				}

				return steps.reduce(function(p_p2, p_step) {
					return p_p2.then(function() {
						if(p_generation.isInterrupted()) {
							return;
						}
console.log(p_step);
console.log('computePlots');
						return p_generator.computePlots({
							address:p_writer.plots.address,
							offset:p_writer.plots.offset + p_step.begin,
							size:p_step.size
						}, buffer)
						.then(function() {
console.log('writePlots');
							return p_writer.writePlots(buffer, p_step.size);
						})
						.then(function() {
console.log('incrementProgress :: ' + p_writer.plots.progress);
							return p_writer.plots.incrementProgress(p_context, p_step.size);
// TODO: progress = writer.getProgress
						});
					});
				}, lib.deps.q.when());
			})
			.then(function() {
				return p_writer.plots.setStatus(p_context, 'generated');
			});
		}, lib.deps.q.when());
	})
	.finally(function() {
		return lib.deps.q.all(resources.map(function(p_resource) {
			return p_resource.close();
		}));
	});
};