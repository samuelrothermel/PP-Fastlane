let profile_data;
let email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let is_guest_payer = true;
let email_input_element = document.getElementById('email');
let identity;
let profile;
let FastlanePaymentComponent;
let FastlaneWatermarkComponent;
let access_token;
let client_id;
let script_tag;
let paypal_button;
let venmo_button;
let method;
let amount_input_element = document.getElementById('amount');
let payment_form = document.getElementById('payment_form');
let process_payment_request;
let process_payment_response;
let amount_paid;
let currency_code;
let payment_method_element = document.getElementById('payment_method');
let buyer_email_element = document.getElementById('buyer_email');
let payment_submit_button = document.getElementById('payment_submit');
let paypal_button_options;
let create_paypal_order_request;
let order_data;
let payment_fetch_options;
let order_fetch_options;
let show_card_fields_button = document.getElementById('show_card_fields');
let paypal_button_container = document.getElementById(
  'paypal_button_container'
);
let venmo_button_container = document.getElementById('venmo_button_container');
let auth_flow_response;
let authentication_state;
let card_fields_container = document.getElementById('card_fields_container');
let lookup_response;
let customer_context_id;
let tokenize_response;
let tokenize_id;
let order_id;
let server_endpoint = '/api/'; // Updated server endpoint
let single_use_token;
let fastlane_options_object;
let payment_source;

// Entry point
get_auth()
  .then(response => response.json())
  .then(init_paypal_script_tag)
  .catch(error => {
    // console.log('uncaught error');
    console.error('Error:', error);
  });

// window.localStorage.setItem('fastlaneEnv', 'sandbox');
window.localStorage.setItem('axoEnv', 'sandbox');

// Fetch an authentication token from the server to load fastlane SDK (card payments)
function get_auth() {
  // console.log('server endpoint for get_auth', server_endpoint);
  return fetch('/api/fastlane_auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'fastlane_auth',
    }),
  });
}

// Initializes the PayPal script tag with the provided access token.
function init_paypal_script_tag(data) {
  access_token = data.access_token;
  console.log('access token', access_token);
  client_id =
    'AUi1ooqXC3edLtnUec5-_xj5eVitpgvBeDk0JH1Ytx4MJC-6xGLgByvogtZVoRxITYpEqqaSUxH2cVY5';
  // Setting script tag attributes
  script_tag = document.createElement('script');
  script_tag.src = `https://www.paypal.com/sdk/js?client-id=${client_id}&components=buttons,fastlane&enable-funding=venmo&disable-funding=card,paylater`;
  script_tag.setAttribute('data-user-id-token', access_token);
  script_tag.setAttribute('data-client-metadata-id', 'testing-sb-fastlane');
  // console.log('Script tag', script_tag);
  document.head.appendChild(script_tag);
  script_tag.onload = init_paypal_payment_options;
  console.log('script_tag triggered', script_tag);
}

// Initializes PayPal payment options by setting up Fastlane and PayPal buttons.
function init_paypal_payment_options() {
  // console.log('initializing payment options');
  init_fastlane_methods();
  paypal_button = bootstrap_standard_button({
    fundingSource: 'paypal',
    style: {
      shape: 'rect',
      color: 'gold',
      label: 'paypal',
      height: 55,
    },
  });
  paypal_button.render('#paypal_button_container');
  venmo_button = bootstrap_standard_button({ fundingSource: 'venmo' });
  venmo_button.render('#venmo_button_container');
}

// Initializes Fastlane methods and sets up event handlers.
async function init_fastlane_methods() {
  console.log('initializing fastlane method');
  let fastlane = await window.paypal.Fastlane({});
  // console.log('fastlane', fastlane);
  fastlane.setLocale('en_us');
  profile = fastlane.profile;
  FastlanePaymentComponent = fastlane.FastlanePaymentComponent;
  identity = fastlane.identity;
  // Fastlane watermark component
  FastlaneWatermarkComponent = await fastlane.FastlaneWatermarkComponent({
    includeAdditionalInfo: true,
  });
  FastlaneWatermarkComponent.render('#watermark-container');
  // Show all form elements now that SDK loading has completed
  ui_display_remaining_elements();
  // Set event listener to handle automatic fastlane lookup on input
  email_input_element.addEventListener('input', function () {
    handle_email_input();
  });
  // Click once to display card fields and check the user email in fastlane for first time
  show_card_fields_button.addEventListener('click', event => {
    if (show_card_fields_button.style.display === 'block') {
      ui_handle_show_card_fields();
      fastlane_display_card_fields();
    }
  });
  // Render the fastlane component
  async function fastlane_display_card_fields() {
    // Optional UI fix
    card_fields_container.style.setProperty(
      'width',
      'calc(100% - 32px)',
      'important'
    );
    card_fields_container.style['margin-bottom'] = '13px';
    fastlane_options_object = {
      styles: {
        root: {
          backgroundColor: 'white',
          errorColor: 'red',
          fontFamily: 'Arial, sans-serif',
          textColorBase: 'black',
          fontSizeBase: '16px',
          padding: '0px',
          primaryColor: 'black',
        },
        input: {
          backgroundColor: 'white',
          borderRadius: '4px',
          borderColor: '#e6e6e6',
          borderWidth: '1px',
          textColorBase: 'black',
          focusBorderColor: 'black',
        },
      },
    };
    FastlanePaymentComponent = await fastlane.FastlanePaymentComponent(
      fastlane_options_object
    );
    FastlanePaymentComponent.render('#card_fields_container');
    setup_payment_handler(FastlanePaymentComponent);
  }

  // IF YOU HAVE SHIPPING
  async function show_shipping_address_selector() {
    let shipping_address_selector = await profile.showShippingAddressSelector();
    let selected_address = shipping_address_selector.selectedAddress;
    let selection_changed = shipping_address_selector.selectionChanged;
    // After user is done with the selection modal
    if (selection_changed) {
      // selectedAddress contains the new address
    } else {
      // Selection modal was dismissed without selection
    }
  }

  // To switch their card
  async function show_card_selector() {
    let card_selector = await profile.showCardSelector();
    let selected_card = card_selector.selectedCard;
    let selection_changed = card_selector.selectionChanged;
    // After user is done with the selection modal
    if (selection_changed) {
      // selectedCard contains the new Card
    } else {
      // Selection modal was dismissed without selection
    }
  }

  // Submit button to process payment
  function setup_payment_handler(FastlanePaymentComponent) {
    payment_submit_button.addEventListener('click', async event => {
      ui_submit_button_clicked();
      console.log('Payment form requested to be submitted.');
      // User typed out card info (guest)
      if (is_guest_payer) {
        tokenize_response = await FastlanePaymentComponent.getPaymentToken({
          billingAddress: {},
        }).catch(error => {
          console.error('Error tokenizing payment:', error);
          revert_submit_button_ui();
        });
        console.log('tokenize response', tokenize_response);
        // Payment source type can be extracted in response
        payment_source = Object.keys(tokenize_response.paymentSource)[0];
        process_payment({
          single_use_token: tokenize_response.id,
          payment_source: payment_source,
        });
      }
      // User passed OTP (fastlane user)
      else {
        process_authenticated_user();
      }
    });
  }
}

// We already have the profile data from fastlane,
// so we can process the payment. No need to display
// card fields nor tokenize any user inputs.
function process_authenticated_user() {
  // In case you want to use any of these for custom UI or receipts
  let name = profile_data.name;
  let shippingAddress = profile_data.shippingAddress;
  let card = profile_data.card;
  process_payment({ single_use_token: card.id, payment_source: 'card' });
}

// Avoid fastlane lookups of a string unless user has entered a valid email
function handle_email_input() {
  if (check_email_validity(email_input_element.value)) {
    console.log(
      'The string "' + email_input_element.value + '" is a valid email address.'
    );
    begin_fastlane_lookup();
  }
}

// Fastlane lookup to decide if UI should be guest payer (if email not found)
// or attempt for one-time-password (OTP) fastlane auth
async function begin_fastlane_lookup() {
  lookup_response = await identity.lookupCustomerByEmail(
    email_input_element.value
  );
  customer_context_id = lookup_response.customerContextId;

  if (customer_context_id) {
    handle_existing_customer(customer_context_id);
  } else {
    // Optional UI fix
    card_fields_container.style.setProperty(
      'width',
      'calc(100% - 32px)',
      'important'
    );
    handle_guest_payer();
  }
}

// Fastlane OTP auth if fastlane matched the email string to a profile
async function handle_existing_customer(customer_context_id) {
  auth_flow_response = await identity.triggerAuthenticationFlow(
    customer_context_id
  );
  authentication_state = auth_flow_response.authenticationState;
  // Can use profileData for "flexible" integration where you would display card details with custom UI
  profile_data = auth_flow_response.profileData;
  console.log(
    'Profile data associated with this fastlane account:',
    profile_data
  );
  // Fastlane OTP auth passed
  if (authentication_state === 'succeeded') {
    console.log('handle existing customer triggered');
    // We click to show the card fields container so that their stored card is displayed for authenticated users
    // For the "Quick Start" integration, this is built in. For "flexible" integration, you would display card details
    ui_handle_show_card_fields();
    fastlane_display_card_fields();
    is_guest_payer = false;
  } else {
    console.error('Failed to authenticate fastlane user.');
  }
}

// Handles guest payer scenario (no fastlane profile found).
function handle_guest_payer() {
  is_guest_payer = true;
  console.log('Handling guest payer');
  // You can also modify your UI to inform the user that they're a guest payer.
}

// Bootstraps the PayPal button with the given options.
function bootstrap_standard_button(options) {
  return paypal.Buttons({
    fundingSource: options.fundingSource,
    style: options.style,
    createOrder: function (data, actions) {
      // Creates an order and returns the order ID.
      return fetch(`${server_endpoint}/create-paypal-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount_input_element.value,
        }),
      })
        .then(response => response.json())
        .then(order => order.id);
    },
    onApprove: function (data, actions) {
      // Handles the approval of the payment.
      return fetch(`${server_endpoint}/capture-paypal-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderID: data.orderID,
        }),
      })
        .then(response => response.json())
        .then(orderData => {
          console.log('Order data:', orderData);
          // Handle the order data.
        });
    },
    onError: function (err) {
      console.error('PayPal button error:', err);
    },
  });
}

// Submits the payment to the server.
function process_payment(payment_payload) {
  fetch(`${server_endpoint}/process-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payment_payload),
  })
    .then(response => response.json())
    .then(response_data => {
      console.log('Payment response:', response_data);
      // Handle the response data.
    })
    .catch(error => {
      console.error('Payment processing error:', error);
    });
}

// Display remaining UI elements when SDK load is done
function ui_display_remaining_elements() {
  email_input_element.style.display = 'block';
  payment_method_element.style.display = 'block';
  amount_input_element.style.display = 'block';
  payment_submit_button.style.display = 'block';
  show_card_fields_button.style.display = 'block';
}

// Show card fields and mark button as clicked (for custom UI)
function ui_handle_show_card_fields() {
  show_card_fields_button.style.display = 'none';
  card_fields_container.style.display = 'block';
}

// Submit button clicked, handle any UI changes
function ui_submit_button_clicked() {
  payment_submit_button.disabled = true;
  payment_submit_button.innerText = 'Processing...';
}

// Revert UI in case of an error
function revert_submit_button_ui() {
  payment_submit_button.disabled = false;
  payment_submit_button.innerText = 'Submit';
}

// Check if the entered email is valid
function check_email_validity(email) {
  return email_regex.test(email);
}
