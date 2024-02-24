import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ticketsque_users_pool_id = "ap-southeast-1_IUCVgcGXk";
// import constants from './constants.json';

import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";

export const insert_dynamo = async (params) => {
  try {
    let respose = await docClient.send(new PutCommand(params));
    return respose;
  }
  catch (err) {
    console.log(params, err);
    throw new Error(err);
  }
};

export const update_dynamo = async (params) => {
  try {
    let response = await docClient.send(new UpdateCommand(params));
    return response;
  }
  catch (err) {
    console.log(params, err);
    throw new Error(err);
  }
};

export const delete_dynamo = async (params) => {
  try {
    let response = await docClient.send(new DeleteCommand(params));
    return response;
  }
  catch (err) {
    console.log(params, err);
    throw new Error(err);
  }
};

export const query_dynamo = async (params) => {
  try {
    let data = await docClient.send(new QueryCommand(params));
    return data;
  }
  catch (err) {
    console.log(err);
    throw new Error(err);
  }
};

export const scan_dynamo = async (params) => {
  try {
    let data = await docClient.send(new ScanCommand(params));
    return data;
  }
  catch (err) {
    console.log(params, err);
    throw new Error(err);
  }
};

export const check_empty_field = (event) => {
  let checkEmptyFields = true;
  for (const field in event) {
    if (typeof event[field] == 'string') {
      if (event[field].length == 0) {
        checkEmptyFields = false;
      }
      else {
        event[field] = event[field].trim();
      }
    }
    else if (Array.isArray(field) && event[field].length == 0) {
      checkEmptyFields = false;
    }
  }
  return checkEmptyFields;
};

export const create_cognito_user = async (userPoolId, email_id, resendInvitation, temporary_password = (+Date.now()).toString(32)) => {
  try {
    console.log("userPoolId :", userPoolId, "email_id:", email_id);
    const client = new CognitoIdentityProviderClient({});
    var params = {
      UserPoolId: userPoolId,
      Username: email_id.trim().toLowerCase(),
      UserAttributes: [{
          Name: 'email',
          Value: email_id.trim().toLowerCase()
        },
        {
          Name: 'email_verified',
          Value: 'true'
        }
      ],
      TemporaryPassword: temporary_password
    };
    if (resendInvitation) {
      params.MessageAction = 'RESEND';
    }
    const command = new AdminCreateUserCommand(params);
    await client.send(command);
    return 'Success';
  }
  catch (err) {
    console.log(params, err);
    throw new Error(err);
  }
};

export const deleteCognitoUser = async (email_id, poolId) => {
  try {
    const client = new CognitoIdentityProviderClient();
    var params = {
      UserPoolId: poolId,
      Username: email_id.trim().toLowerCase()
    };
    const command = new AdminDeleteUserCommand(params);
    await client.send(command);
    return 'Success';
  }
  catch (err) {
    console.log(params, err);
    throw new Error(err);
  }
};

export const sign_up_users = async (event) => {
  if (check_empty_field) {
    let checkIfUserExistsParams = {
      TableName: "auction_users",
      IndexName: "user_email_id-index",
      KeyConditionExpression: "user_email_id = :user_email_id",
      ExpressionAttributeValues: {
        ':user_email_id': event.user_email_id
      }
    };
    let user = await query_dynamo(checkIfUserExistsParams);
    if (user.Count == 0) {
      let newUserParams = {
        TableName: 'auction_users',
        Item: {
          user_id: uuidv4(),
          first_name: event.first_name,
          last_name: event.last_name,
          user_full_name: event.user_full_name ? event.user_full_name : event.first_name + " " + event.last_name,
          user_email_id: event.user_email_id,
          user_phone_number: event.user_phone_number,
          user_cteated_on: new Date().toISOString(),
          user_status: "Active"
        },
      };
      await insert_dynamo(newUserParams);
      await create_cognito_user(ticketsque_users_pool_id, event.user_email_id, false);
      return {
        status: "sucess",
        stastus_message: "Congratulations! You've successfully signed up as a new user!"
      };
    }
    else {
      throw new Error("Oops! It seems that this user already exists.");
    }
  }
  else {
    throw new Error("Oops! It looks like there are empty fields. In order to sign up, please make sure to fill in all the required information.");
  }
};

export const add_products_to_auction = async (event) => {
  if (check_empty_field) {
    let checkIfUserExistsParams = {
      TableName: "auction_users",
      IndexName: "user_email_id-index",
      KeyConditionExpression: "user_email_id = :user_email_id",
      ExpressionAttributeValues: {
        ':user_email_id': event.user_email_id
      }
    };
    let user = await query_dynamo(checkIfUserExistsParams);
    if (user.Count > 0) {
      let newProductParams = {
        TableName: 'auction_products',
        Item: {
          product_id: uuidv4(),
          user_id: user.Items[0].user_id,
          product_name: event.product_name,
          bids_place: event.bids_place,
          auction_cteated_on: new Date().toISOString(),
          product_status: "Bidding started",
          product_minimum_price: event.product_minimum_price
        },
      };
      await insert_dynamo(newProductParams);
      return {
        status: "sucess",
        stastus_message: "Your products have been successfully added to the auctions!"
      };
    }
    else {
      throw new Error("Oops! It appears that this user does not exist. Please double-check the user email id or sign up to create a new account.");
    }
  }
  else {
    throw new Error("Oops! It seems there was an empty field. Please ensure all necessary information is provided before adding products to the auction.");
  }
};

export const update_users_details = async (event) => {
  let checkUserExistsParams = {
    TableName: "auction_users",
    IndexName: 'user_email_id-index',
    KeyConditionExpression: "user_email_id = :user_email_id",
    ExpressionAttributeValues: {
      ':user_email_id': event.user_email_id
    }
  };
  let user = await query_dynamo(checkUserExistsParams);
  if (user.Count > 0) {
    let updateUserDetails = {
      TableName: "auction_users",
      Key: {
        user_id: user.Items[0].user_id
      },
      UpdateExpression: "set first_name = :first_name, last_name = :last_name, user_full_name = :user_full_name, user_phone_number = :user_phone_number, user_status = :user_status",
      ExpressionAttributeValues: {
        ':first_name': event.first_name ? event.first_name : user.Items[0].first_name,
        ':last_name': event.last_name ? event.last_name : user.Items[0].last_name,
        ':user_full_name': event.user_full_name ? event.user_full_name : event.first_name + " " + event.last_name,
        ':user_phone_number': event.user_phone_number ? event.user_phone_number : user.Items[0].user_phone_number,
        ':user_status': event.user_status ? event.user_status : user.Items[0].user_status,
      },
    };
    await update_dynamo(updateUserDetails);
    return {
      status: "success",
      status_message: "Great news! user details have been successfully updated!"
    };
  }
  else {
    throw new Error("Oops! User not found. Please double-check the email_id provided.");
  }
};

export const bidding_products = async (event) => {
  if (check_empty_field) {
    let checkUserExistsParams = {
      TableName: "auction_users",
      IndexName: 'user_email_id-index',
      KeyConditionExpression: "user_email_id = :user_email_id",
      ExpressionAttributeValues: {
        ':user_email_id': event.user_email_id
      }
    };
    let user = await query_dynamo(checkUserExistsParams);
    if (user.Count > 0) {
      let checkProductExistsParams = {
        TableName: "auction_products",
        KeyConditionExpression: 'product_id = :product_id',
        ExpressionAttributeValues: {
          ':product_id': event.product_id
        }
      };
      let product_details = await query_dynamo(checkProductExistsParams);
      if (product_details.Count > 0) {
        let addBiddingPriceParams = {
          TableName: "bidding_users",
          Item: {
            product_id: product_details.Items[0].product_id,
            user_id: user.Items[0].user_id,
            bidding_price: event.bidding_price,
            user_email_id: user.Items[0].user_email_id
          }
        };
        await insert_dynamo(addBiddingPriceParams);
        return {
          status: "success",
          status_message: "Success! The bidding price for the product has been successfully added."
        };
      }
      else {
        throw new Error("We couldn't find any data for the product with ID: " + event.product_id + ". Please verify the product ID and try again.");
      }
    }
    else {
      throw new Error("Oops! User not found. Please double-check the email_id provided.");
    }
  }
  else {
    throw new Error("Oops! It seems there was an empty field. Please ensure all necessary information is provided before adding bidding price to the product.");
  }
};

export const update_products_details = async (event) => {
  if (check_empty_field) {
    let checkUserExistsParams = {
      TableName: "auction_users",
      IndexName: 'user_email_id-index',
      KeyConditionExpression: "user_email_id = :user_email_id",
      ExpressionAttributeValues: {
        ':user_email_id': event.user_email_id
      }
    };
    let user = await query_dynamo(checkUserExistsParams);
    if (user.Count > 0) {
      let checkProductExistsParams = {
        TableName: "auction_products",
        KeyConditionExpression: 'product_id = :product_id',
        ExpressionAttributeValues: {
          ':product_id': event.product_id
        }
      };
      let product_details = await query_dynamo(checkProductExistsParams);
      if (product_details.Count > 0) {
        let updateProductsDetailsParams = {
          TableName: "auction_products",
          Key: {
            product_id: product_details.Items[0].product_id
          },
          UpdateExpression: "set product_name = :product_name, product_minimum_price = :product_minimum_price, bids_place = :bids_place, product_status = :product_status",
          ExpressionAttributeValues: {
            ':product_name': event.product_name ? event.product_name : product_details.Items[0].product_name,
            ':product_minimum_price': event.product_minimum_price ? event.product_minimum_price : product_details.Items[0].product_minimum_price,
            ':bids_place': event.bids_place ? event.bids_place : event.bids_place,
            ':product_status': event.product_status ? event.product_status : product_details.Items[0].product_status,
          },
        };
        await update_dynamo(updateProductsDetailsParams);
        return {
          status: "SUCCESS",
          status_message: "Success! The product details have been successfully updated."
        };
      }
      else {
        throw new Error("We couldn't find any data for the product with ID: " + event.product_id + ". Please verify the product ID and try again.");
      }
    }
    else {
      throw new Error("Oops! User not found. Please double-check the email_id provided.");
    }
  }
  else {
    throw new Error("Oops! It seems that there is an empty field preventing the product update. Please ensure all fields are filled in before proceeding with the update.");
  }
};

export const winning_bids = async (event) => {
  if (check_empty_field) {
    let getAllBiddersOfTheProduct = {
      TableName: "bidding_users",
      IndexName: "product_id-index",
      KeyConditionExpression: "product_id = :product_id",
      ExpressionAttributeValues: {
        ':product_id': event.product_id
      }
    };
    let bidders = await query_dynamo(getAllBiddersOfTheProduct);
    if (bidders.Count > 0) {
      const bidding_prices = [];
      for (let i = 0; i < bidders.Items.length; i++) {
        bidding_prices.push(bidders.Items[i].bidding_price);
      }
      let higher_bidder_price = Math.max(...bidding_prices);
      let checkProductExistsParams = {
        TableName: "auction_products",
        KeyConditionExpression: 'product_id = :product_id',
        ExpressionAttributeValues: {
          ':product_id': event.product_id
        }
      };
      const product_details = await query_dynamo(checkProductExistsParams);
      let updateHigherbidderPrice = {
        TableName: "auction_products",
        Key: {
          product_id: product_details.Items[0].product_id
        },
        UpdateExpression: "set auction_cteated_on = :auction_cteated_on,bids_place = :bids_place, highest_bidder_price = :highest_bidder_price, product_minimum_price = :product_minimum_price, product_name = :product_name, product_status = :product_status,user_id = :user_id",
        ExpressionAttributeValues: {
          ':auction_cteated_on': product_details.Items[0].auction_cteated_on,
          ':bids_place': product_details.Items[0].bids_place,
          ':highest_bidder_price': higher_bidder_price,
          ':product_minimum_price': product_details.Items[0].product_minimum_price,
          ':user_id': product_details.Items[0].user_id,
          ':product_status': "sold",
          ':product_name': product_details.Items[0].product_name
        },
      };
      await update_dynamo(updateHigherbidderPrice);
      return {
        status: "success",
        status_message: "Fantastic! The higher bidder price has been successfully updated. Happy bidding!"
      };
    }
    else {
      return {
        status_message: "Oops! It seems that no one is currently bidding on this product. Please ensure you have entered a valid product ID."
      };
    }
  }
  else {
    throw new Error("Oops! It appears there was an empty field. Please make sure to provide all necessary information before retrieving the highest bidder price for the product.");
  }
};

export const delete_user = async (event) => {
  if (check_empty_field) {
    let checkUserExistsParams = {
      TableName: "auction_users",
      IndexName: "user_email_id-index",
      KeyConditionExpression: "user_email_id = :user_email_id",
      ExpressionAttributeValues: {
        ':user_email_id': event.user_email_id
      }
    };
    let user = await query_dynamo(checkUserExistsParams);
    if (user.Count > 0) {
      let getBiddingUsersParams = {
        TableName: "bidding_users",
        IndexName: "user_id-index",
        KeyConditionExpression: "user_id = :user_id",
        ExpressionAttributeValues: {
          ':user_id': user.Items[0].user_id
        }
      };
      let biddingUserProducts = await query_dynamo(getBiddingUsersParams);
      if (biddingUserProducts.Count > 0) {
        for (let i = 0; i < biddingUserProducts.Items.length; i++) {
          let deleteBiddingUsersParams = {
            TableName: "bidding_users",
            Key: {
              product_id: biddingUserProducts.Items[i].product_id,
              user_id: biddingUserProducts.Items[i].user_id
            }
          };
          await delete_dynamo(deleteBiddingUsersParams);
        }
      }
      let getAuctionUsersProducts = {
        TableName: "auction_products",
        IndexName: "user_id-index",
        KeyConditionExpression: "user_id = :user_id",
        ExpressionAttributeValues: {
          ':user_id': user.Items[0].user_id
        }
      };
      let auctionUserProducts = await query_dynamo(getAuctionUsersProducts);
      if (auctionUserProducts.Count > 0) {
        for (let i = 0; i < auctionUserProducts.Items.length; i++) {
          let deleteUsersItems = {
            TableName: "auction_products",
            Key: {
              product_id: auctionUserProducts.Items[i].product_id
            }
          };
          await delete_dynamo(deleteUsersItems);
        }
      }
      let deleteAuctionUserParams = {
        TableName: "auction_users",
        Key: {
          user_id: user.Items[0].user_id
        },
      };
      await delete_dynamo(deleteAuctionUserParams);
      await deleteCognitoUser(event.user_email_id, ticketsque_users_pool_id);
      return {
        status: "success",
        status_message: "User successfully deleted!",
      };
    }
    else {
      throw new Error('User Not Found!');
    }
  }
  else {
    throw new Error("Oops! It appears there was an empty field. Please make sure to provide all necessary information before deleting the user.");
  }
};

export const get_current_users = async (event) => {
  let getAllUsersParams = {
    TableName: 'auction_users'
  };
  let all_users = await scan_dynamo(getAllUsersParams);
  return {
    status: "success",
    response: all_users.Items
  };
};

export const list_all_items = async (event) => {
  let getAllItemsParams = {
    TableName: 'auction_products',
    ProjectionExpression: "product_id, product_name, product_status, bids_place, product_minimum_price, auction_created_on"
  };
  let all_items = await scan_dynamo(getAllItemsParams);

  return {
    status: "success",
    response: all_items.Items
  };
};

export const list_All_bids = async (event) => {
  let getAllBidsParams = {
    TableName: 'bidding_users'
  };
  let all_bids = await scan_dynamo(getAllBidsParams);

  return {
    status: "success",
    response: all_bids.Items
  };
};

export const all_bids_of_product = async (event) => {
  if (check_empty_field) {
    let getAllBiddersOfTheProduct = {
      TableName: "bidding_users",
      IndexName: "product_id-index",
      KeyConditionExpression: "product_id = :product_id",
      ExpressionAttributeValues: {
        ':product_id': event.product_id
      }
    };
    let bidders = await query_dynamo(getAllBiddersOfTheProduct);
    if (bidders.Count > 0) {
      return {
        status: "Success",
        status_message: bidders.Items
      };
    }
    else {
      return {
        status_message: "Oops! It seems that no one is currently bidding on this product. Please ensure you have entered a valid product ID."
      };
    }
  }
  else {
    throw new Error("Oops! It appears there was an empty field. Please make sure to provide all necessary information before retrieving the highest bidder price for the product.");
  }
};

export const handler = async (event) => {
  console.log(JSON.stringify(event));
  switch (event.command) {
    case 'signUpUsers':
      return await sign_up_users(event);
    case 'addProductsToAuction':
      return await add_products_to_auction(event);
    case 'updateUsersDetails':
      return await update_users_details(event);
    case 'biddingProducts':
      return await bidding_products(event);
    case 'getCurrentUser':
      return await get_current_users(event);
    case 'listAllItems':
      return await list_all_items(event);
    case 'ListAllBids':
      return list_All_bids(event);
    case 'allBidsOfProduct':
      return await all_bids_of_product(event);
    case 'updateProductsDetails':
      return await update_products_details(event);
    case 'winningBids':
      return await winning_bids(event);
    case 'deleteUser':
      return await delete_user(event);
    default:
      throw new Error('Command Not Found!');
  }
};
