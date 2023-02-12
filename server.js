const express = require('express')
const app = express()
const port = 3000;
const { buildSchema, GraphQLError } = require('graphql');
const { graphqlHTTP } = require('express-graphql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const User  = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
require('./connection');
const secret =  'mysecret';

/// lab //////
// update post
// delete post 
// get one post 
// post commments : crud operation 
// on getting post : comments

const schema = buildSchema(`
	type User {
		name:String!
		email:String!
		posts:[Post]
	}
	type Comment{
		content:String!
		userId:User
		postId:Post
	}
	type Post {
		title:String!
		content:String!
		user:User
		comments:[Comment]
	}
	input UserInput {
		name:String!
		email:String!
		password:String!
	}
	type Query {
		test:String
		usersGetAll:[User!]!
		userGetOne(id:ID!):User!
		getMyPosts(token:String!):[Post!]!
		postGetOne(postId:ID!,token:String!):Post!
		commentsGetAll(postId:ID!,token:String!):[Comment!]
		commentGetOne(postId:ID!,token:String!,commentId:ID!):Comment
	}
	type Mutation {
		userCreate(input:UserInput):User
		userLogin(email:String!,password:String!):String
		postCreate(title:String!,content:String!,token:String!):String
		postUpdate(postId:String!,title:String!,content:String!,token:String!):String
		postDelete(postId:String!,token:String!):String
		commentCreate(postId:ID!,token:String!,content:String!):String
		commentUpdate(postId:ID!,token:String!,commentId:ID!,content:String!):String
		commentDelete(postId:ID!,token:String!,commentId:ID!):String
	}
`)
const userQueries = {
	test: async()=>{
		const user = await User.find().populate('posts');
		console.log(JSON.stringify(user, null, 2))
		return 'test'
	},
	usersGetAll: async()=>{
		const users = await User.find();
		return users;
	},
	userGetOne: async ({ id })=>{
		const user = await User.findById(id).populate('posts');
		console.log("🚀 ~ file: server.js:55 ~ userGetOne: ~ user", user)
		return user;
	}
}
const userMutations = {
	userCreate: async ({ input })=>{
		const { name, email, password } = input;
		const hashedPassword = await bcrypt.hash(password, 10);
		const UserCreated = new User({ name, email, password:hashedPassword });
		console.log(hashedPassword);
		await UserCreated.save();
		return {
			name,
			email
		}
	},
	userLogin: async ({ email, password })=>{
		const user = await User.findOne({ email });
		const isValidPassword = await bcrypt.compare(password, user?.password);
		if (!user|| !isValidPassword) throw new Error('Invalid credentials');
		console.log('user',user);
		const token = jwt.sign({ userId:user._id },secret);
		return token;
	}
}
const auth = async (token)=>{
	const { userId } = jwt.verify(token,secret);
	const user = await User.findById(userId);
	return user;
}
const postQueries = {
	getMyPosts: async ({ token })=>{
		const user = await auth(token);
		const posts = await Post.find({ userId:user._id }).populate('userId');
		debugger;
		// console.log('posts',posts);
		return posts.map(post=>({ ...post._doc, user:post.userId }));
	},
	postGetOne:async ({ postId, token })=>{
		const user = await auth(token);
		const post = await Post.findOne({postId, userId:user.id}).populate("comments");
		console.log(post);
		if(!post) return 'Post Not Found';
		else return post;
	},
}
const postMutations = {
	postCreate: async({ postId, title, content, token })=>{
		const user = await auth(token);
		const post = new Post({ title,content, userId:user._id });
		console.log('user', user);
		await post.save();
		return 'Post Created';
	},
	postUpdate: async({ postId, title, content, token })=>{
		const user = await auth(token);
		const post = await Post.findByIdAndUpdate(postId, {title, content});
		if(!post) return 'Post Not Found';
		else return 'Post Updated';
		// if(!user){
		// 	throw new Error('you are not authorized to perform this operation');
		// }
	},
	postDelete: async({ postId, token })=>{
		const user = await auth(token);
		const post = await Post.findByIdAndDelete(postId);
		if(!post) return 'Post Not Found';
		else return 'Post Deleted';
	}
}
const commentQueries = {
	commentsGetAll: async ({ postId, token }) =>{
		const user = await auth(token);
		const comments = await Comment.find({userId:user.id, postId}).populate("postId userId");
		// console.log(comments);
		return comments;
	},
	commentGetOne: async ({ postId, token, commentId }) =>{
		const user = await auth(token);
		const comment = await Comment.findOne({postId, userId:user.id, _id:commentId}).populate("postId userId");
		if(!comment)  return "Comment Not Found";
		else return comment;
	}
}
const commentMutations = {
	commentCreate: async({ postId, token, content })=>{
		const user = await auth(token);
		const comment = new Comment({postId, userId:user._id, content});
		await comment.save();
		return 'comment created';
	},
	commentUpdate: async({ postId, token,commentId, content }) =>{
		const user = await auth(token);
		const comment = await Comment.findOneAndUpdate({postId, userId:user.id, _id:commentId}, {content});
		if(comment) return 'Comment Updated';
		else return 'Comment Not Found';
	},
	commentDelete: async({ postId, token, commentId }) =>{
		const user = await auth(token);
		const comment = await Comment.findOneAndDelete({postId, userId:user.id, _id:commentId});
		if(comment) return 'Comment Deleted';
		else return 'Comment Not Found';
	}
}
const resolvers = {
	...userQueries,
	...userMutations,
	...postQueries,
	...postMutations,
	...commentQueries,
	...commentMutations
}
app.use('/graphql', graphqlHTTP({ schema, rootValue: resolvers, graphiql: true }))

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`)
})