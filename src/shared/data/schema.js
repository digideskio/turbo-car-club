/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  // GraphQLBoolean,
  // GraphQLFloat,
  // GraphQLID,
  // GraphQLInt,
  // GraphQLList,
  // GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString
} from 'graphql';

import {
  connectionArgs,
  connectionDefinitions,
  connectionFromArray,
  fromGlobalId,
  globalIdField,
  // mutationWithClientMutationId,
  nodeDefinitions
} from 'graphql-relay';

import {
  // Import methods that your schema can use to interact with your database
  User,
  Widget,
  getUser,
  getViewer,
  getWidget,
  getWidgets
} from './database';

import {Host} from './host';

/**
 * We get the node interface and field from the Relay library.
 *
 * The first method defines the way we resolve an ID to its object.
 * The second defines the way we resolve an object to its GraphQL type.
 */
var {nodeInterface, nodeField} = nodeDefinitions(
  (globalId) => {
    var {type, id} = fromGlobalId(globalId);
    if (type === 'User') return getUser(id);
    if (type === 'Widget') return getWidget(id);
    if (type === 'Host') return new Host();
    return null;
  },
  (obj) => {
    if (obj instanceof User) return userType;
    if (obj instanceof Widget) return widgetType;
    if (obj instanceof Host) return hostType;
    return null;
  }
);

/**
 * Define your own types here
 */

var userType = new GraphQLObjectType({
  name: 'User',
  description: 'A person who uses our app',
  fields: () => ({
    id: globalIdField('User'),
    name: {type: GraphQLString},
    emailAddress: {type: GraphQLString},
    signedInAt: {type: GraphQLString},
    createdAt: {type: GraphQLString},
    widgets: {
      type: widgetConnection,
      description: 'A person\'s collection of widgets',
      args: connectionArgs,
      resolve: (_, args) => connectionFromArray(getWidgets(), args)
    }
  }),
  interfaces: [nodeInterface]
});

var hostType = new GraphQLObjectType({
  name: 'Host',
  description: 'A person who uses our app',
  fields: () => ({
    id: globalIdField('Host'),
    name: {type: GraphQLString},
    region: {type: GraphQLString},
    user: {
      type: userType
    }
  }),
  interfaces: [nodeInterface]
});

var widgetType = new GraphQLObjectType({
  name: 'Widget',
  description: 'A shiny widget',
  fields: () => ({
    id: globalIdField('Widget'),
    name: {
      type: GraphQLString,
      description: 'The name of the widget'
    }
  }),
  interfaces: [nodeInterface]
});

/**
 * Define your own connection types here
 */
var {connectionType: widgetConnection} =
  connectionDefinitions({name: 'Widget', nodeType: widgetType});

/**
 * This is the type that will be the root of our query,
 * and the entry point into our schema.
 */
var queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    node: nodeField,
    // Add your own root fields here
    viewer: {
      type: userType,
      resolve: () => getViewer()
    },
    hosts: {
      type: hostType
    }
  })
});

/**
 * This is the type that will be the root of our mutations,
 * and the entry point into performing writes in our schema.
 */
// var mutationType = new GraphQLObjectType({
//   name: 'Mutation',
//   fields: () => ({
//     // Add your own mutations here
//   })
// });

/**
 * Finally, we construct our schema (whose starting query type is the query
 * type we defined above) and export it.
 */
export default new GraphQLSchema({
  query: queryType
  // Uncomment the following after adding some mutation fields:
  // mutation: mutationType
});
