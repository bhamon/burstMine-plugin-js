/*
	Burst mine
	Distributed graphical plotter and miner for Burst.
	Author: Cryo
	Bitcoin: 138gMBhCrNkbaiTCmUhP9HLU9xwn5QKZgD
	Burst: BURST-YA29-QCEW-QXC3-BKXDL
*/

context.addController('burstMine-plugin-js-strategy-singleStreamed-edit', [
	'$scope', '$q', '$http', 'burstMine-config', 'component',
	function($scope, $q, $http, p_config, p_component) {
		$scope.error = null;
		$scope.generatorPresets = [];

		$scope.data = p_component.params;
		$scope.data.generatorPreset = null;
// TODO: review
		$scope.clearError = function() {
			$scope.error = null;
		};

		$scope.loadGenerators = function() {
			var defer = $q.defer();
			$scope.clearError();
			$scope.generatorPresets = [];

			$http.get(p_config.apiPath + '/generatorPresets')
			.success(function(p_data) {
				$scope.generatorPresets = p_data;
				defer.resolve();
			})
			.error(function(p_data) {
				$scope.error = p_data;
				defer.reject(p_data);
			});

			return defer.promise;
		};

		$scope.loadGenerators();
	}
]);