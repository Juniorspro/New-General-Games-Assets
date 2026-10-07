// SkeletonUtils.clone de three.js r160 (MIT), pasado a script común: clonar una
// malla con esqueleto con .clone() deja los huesos compartidos y todas las
// copias bailan juntas. Copiadas tal cual clone() y parallelTraverse().
(() => {
function parallelTraverse( a, b, callback ) {

	callback( a, b );

	for ( let i = 0; i < a.children.length; i ++ ) {

		parallelTraverse( a.children[ i ], b.children[ i ], callback );

	}

}

function clone( source ) {

	const sourceLookup = new Map();
	const cloneLookup = new Map();

	const clone = source.clone();

	parallelTraverse( source, clone, function ( sourceNode, clonedNode ) {

		sourceLookup.set( clonedNode, sourceNode );
		cloneLookup.set( sourceNode, clonedNode );

	} );

	clone.traverse( function ( node ) {

		if ( ! node.isSkinnedMesh ) return;

		const clonedMesh = node;
		const sourceMesh = sourceLookup.get( node );
		const sourceBones = sourceMesh.skeleton.bones;

		clonedMesh.skeleton = sourceMesh.skeleton.clone();
		clonedMesh.bindMatrix.copy( sourceMesh.bindMatrix );

		clonedMesh.skeleton.bones = sourceBones.map( function ( bone ) {

			return cloneLookup.get( bone );

		} );

		clonedMesh.bind( clonedMesh.skeleton, clonedMesh.bindMatrix );

	} );

	return clone;

}

THREE.SkeletonUtils = { clone };
})();
