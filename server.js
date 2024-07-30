import express from 'express';
import fetch from 'node-fetch';
import 'dotenv/config';
import bodyParser from 'body-parser';

const app = express();
const port = process.env.PORT || 8888;

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('client'));

// parse post params sent in body in json format
app.use(express.json());

// Middleware
app.use(bodyParser.json());

// Environment Variables
const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const FASTLANE_APPROVED_DOMAINS_CSV = process.env.DOMAINS;
const PAYPAL_API_BASE_URL = 'https://api-m.sandbox.paypal.com';

// Routes
app.post('/api/fastlane_auth', async (req, res) => {
  let result = await handle_fastlane_auth();
  res.json(result.body);
});

app.post('/api/auth', async (req, res) => {
  let result = await handle_auth();
  res.status(result.statusCode).json(result.body);
});

app.post('/api/card_order', async (req, res) => {
  let result = await handle_card_order(req.body);
  res.status(result.statusCode).json(result.body);
});

app.post('/api/create_order', async (req, res) => {
  // console.log('creating order on server');
  let result = await handle_create_order(req.body);
  // console.log('received response on create order');

  // Log the response before sending it
  console.log('Response:', {
    statusCode: result.statusCode,
    body: result.body,
  });

  res.status(result.statusCode).json(result.body);
});

app.post('/api/complete_order', async (req, res) => {
  let result = await handle_complete_order(req.body);
  res.status(result.statusCode).json(result.body);
});

// Handlers
const handle_auth = async () => {
  try {
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    return { statusCode: 200, body: { access_token } };
  } catch (error) {
    console.error('Error in handle_auth:', error);
    return { statusCode: 500, body: error.toString() };
  }
};

// const handle_fastlane_auth = async () => {
//   try {
//     let access_token_response = await get_access_token();
//     let access_token = access_token_response.access_token;
//     console.log('access_token', access_token);
//     let fastlane_auth_response = await fetch(
//       `${PAYPAL_API_BASE_URL}/v1/oauth2/token`,
//       {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded',
//           Authorization: `Bearer ${access_token}`,
//         },
//         body: new URLSearchParams({
//           grant_type: 'client_credentials',
//           response_type: 'client_token',
//           intent: 'sdk_init',
//           'domains[]': 'paypal.com',
//         }),
//       }
//     );
//     // console.log('fastlane_auth_response', fastlane_auth_response_json);
//     let fastlane_auth_response_json = await fastlane_auth_response.json();
//     console.log('fastlane_auth_response', fastlane_auth_response_json);
//     return {
//       statusCode: 200,
//       body: { access_token: fastlane_auth_response_json.access_token },
//     };
//   } catch (error) {
//     console.error('Error in handle_fastlane_auth:', error);
//     return { statusCode: 500, body: error.toString() };
//   }
// };

const handle_fastlane_auth = async () => {
  try {
    const headers = new Headers();
    const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString(
      'base64'
    );
    headers.append('Authorization', `Basic ${auth}`);
    headers.append('Content-Type', 'application/x-www-form-urlencoded');

    const searchParams = new URLSearchParams();
    searchParams.append('grant_type', 'client_credentials');
    searchParams.append('response_type', 'client_token');
    searchParams.append('intent', 'sdk_init');
    searchParams.append('domains[]', 'paypal.com');
    const options = {
      method: 'POST',
      headers,
      body: searchParams,
    };
    const response = await fetch(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      options
    );
    // console.log('fastlane_auth_response', fastlane_auth_response_json);
    let fastlane_auth_response_json = await response.json();
    // console.log('fastlane_auth_response', fastlane_auth_response_json);
    return {
      statusCode: 200,
      body: { access_token: fastlane_auth_response_json.access_token },
    };
  } catch (error) {
    console.error('Error in handle_fastlane_auth:', error);
    return { statusCode: 500, body: error.toString() };
  }
};

const handle_card_order = async request_body => {
  try {
    let { amount, payment_source, single_use_token, shipping_address } =
      request_body;
    let create_order_response = await create_order({
      amount,
      payment_source,
      single_use_token,
      shipping_address,
    });
    return { statusCode: 200, body: create_order_response };
  } catch (error) {
    console.error('Error in handle_card_order:', error);
    return { statusCode: 500, body: error.toString() };
  }
};

const handle_create_order = async request_body => {
  try {
    let { amount, payment_source, shipping_address } = request_body;
    console.log('Received request body:', request_body);

    let create_order_request = await create_order({
      amount,
      payment_source,
      shipping_address,
    });
    console.log('Order created:', create_order_request);

    if (!create_order_request.id) {
      console.error('Order id is undefined:', create_order_request);
    }

    return { statusCode: 200, body: create_order_request };
  } catch (error) {
    console.error('Error in handle_create_order:', error);
    return { statusCode: 500, body: error.toString() };
  }
};

const handle_complete_order = async request_body => {
  try {
    let capture_paypal_order_response = await capture_paypal_order(
      request_body.order_id
    );
    return { statusCode: 200, body: capture_paypal_order_response };
  } catch (error) {
    console.error('Error in handle_complete_order:', error);
    return { statusCode: 500, body: error.toString() };
  }
};

const get_access_token = async () => {
  try {
    let auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString(
      'base64'
    );
    let request_body = 'grant_type=client_credentials';
    let access_token_request = await fetch(
      `${PAYPAL_API_BASE_URL}/v1/oauth2/token`,
      {
        method: 'POST',
        body: request_body,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    let access_token_response = await access_token_request.json();
    if (!access_token_request.ok) {
      throw new Error(
        access_token_response.error_description ||
          'Failed to fetch access token'
      );
    }
    return { access_token: access_token_response.access_token };
  } catch (error) {
    console.error('Error fetching access token:', error);
    return { statusCode: 400, body: error.toString() };
  }
};

const capture_paypal_order = async order_id => {
  try {
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    let url = `${PAYPAL_API_BASE_URL}/v2/checkout/orders/${order_id}/capture`;

    let capture_request = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: '{}',
    });

    let capture_response = await capture_request.json();
    let sanitized_paypal_capture_response = {
      amount: {
        value:
          capture_response.purchase_units[0].payments.captures[0].amount.value,
        currency:
          capture_response.purchase_units[0].payments.captures[0].amount
            .currency_code,
      },
      payment_method: {},
    };

    if (capture_response.payment_source.paypal) {
      sanitized_paypal_capture_response.payment_method.type = 'paypal';
      sanitized_paypal_capture_response.payment_method.details = {
        email: capture_response.payment_source.paypal.email_address,
      };
    }

    if (capture_response.payment_source.venmo) {
      sanitized_paypal_capture_response.payment_method.type = 'venmo';
      sanitized_paypal_capture_response.payment_method.details = {
        email: capture_response.payment_source.venmo.email_address,
      };
    }

    return sanitized_paypal_capture_response;
  } catch (error) {
    console.error('Error in capture_paypal_order:', error);
    throw error;
  }
};

const create_order = async request_object => {
  try {
    let { amount, payment_source, single_use_token, shipping_address } =
      request_object;
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    let create_order_endpoint = `${PAYPAL_API_BASE_URL}/v2/checkout/orders`;
    // console.log('payment source', payment_source);
    let purchase_unit_object = {
      amount: {
        currency_code: 'USD',
        value: amount,
        breakdown: {
          item_total: {
            currency_code: 'USD',
            value: amount,
          },
        },
      },
      items: [
        {
          name: 'Buy Me',
          quantity: '1',
          category: shipping_address ? 'PHYSICAL_GOODS' : 'DIGITAL_GOODS',
          unit_amount: {
            currency_code: 'USD',
            value: amount,
          },
        },
      ],
    };

    if (shipping_address) {
      purchase_unit_object.shipping = {
        options: [
          {
            id: 'my_custom_shipping_option_1',
            label: 'Free Shipping',
            type: 'SHIPPING',
            selected: true,
            amount: {
              currency_code: 'USD',
              value: '0.00',
            },
          },
          {
            id: 'my_custom_shipping_option_2',
            label: 'Basic Shipping',
            type: 'SHIPPING',
            selected: false,
            amount: {
              currency_code: 'USD',
              value: '3.50',
            },
          },
        ],
        name: {
          full_name: 'John Doe',
        },
        address: shipping_address,
      };
    }

    let payload = {
      intent: 'CAPTURE',
      purchase_units: [purchase_unit_object],
      payment_source: {},
    };
    payload.payment_source[payment_source] = {
      experience_context: {
        brand_name: 'BUY ME',
        shipping_preference: shipping_address ? 'GET_FROM_FILE' : 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
      },
    };

    if (payment_source === 'card') {
      purchase_unit_object.soft_descriptor = 'BIZNAME HERE';
      payload.payment_source.card = { single_use_token: single_use_token };
    }

    console.log('create order request payload', payload);
    let create_order_request = await fetch(create_order_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
        'PayPal-Request-Id': Math.random().toString(),
      },
      body: JSON.stringify(payload),
    });

    let json_response = await create_order_request.json();
    console.log('json response from create order request', json_response);

    if (payment_source === 'card') {
      let sanitized_card_capture_response = {
        amount: {
          value:
            json_response.purchase_units[0].payments.captures[0].amount.value,
          currency:
            json_response.purchase_units[0].payments.captures[0].amount
              .currency_code,
        },
        payment_method: {
          type: 'card',
          details: {
            brand: json_response.payment_source.card.brand,
            last_digits: json_response.payment_source.card.last_digits,
            name: json_response.payment_source.card.name,
          },
        },
      };
      return sanitized_card_capture_response;
    } else {
      return { id: json_response.id };
    }
  } catch (error) {
    console.error('Error creating order:', error);
    return { statusCode: 400, body: error.toString() };
  }
};

// render checkout page with client id & unique client token
app.get('/', async (req, res) => {
  try {
    res.render('index');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
