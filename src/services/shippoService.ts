interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

interface ShippingRate {
  object_id: string;
  amount: string;
  currency: string;
  amount_local: string;
  currency_local: string;
  provider: string;
  servicelevel: {
    name: string;
    token: string;
    terms: string;
  };
  estimated_days: number;
  duration_terms: string;
}

interface ShippingLabel {
  object_id: string;
  status: string;
  label_url: string;
  tracking_number: string;
  tracking_url_provider: string;
  eta: string;
  rate: ShippingRate;
}

interface ShipmentRequest {
  address_from: ShippingAddress;
  address_to: ShippingAddress;
  parcels: Array<{
    length: string;
    width: string;
    height: string;
    distance_unit: string;
    weight: string;
    mass_unit: string;
  }>;
  async?: boolean;
}

interface TransactionRequest {
  rate: string;
  label_file_type: string;
  async?: boolean;
}

const SHIPPO_API_KEY = import.meta.env.VITE_SHIPPO_API_KEY;
const SHIPPO_API_URL = 'https://api.goshippo.com';

class ShippoService {
  private apiKey: string;

  constructor(apiKey: string = SHIPPO_API_KEY) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${SHIPPO_API_URL}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `ShippoToken ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Shippo API error: ${response.status} - ${errorData.detail || response.statusText}`);
    }

    return response.json();
  }

  async validateAddress(address: ShippingAddress): Promise<any> {
    try {
      const response = await this.makeRequest('/addresses/', 'POST', {
        ...address,
        validate: true,
      });
      console.log("VALIDATE ADDRESS RESPONSE: ",response)
      return response;
    } catch (error) {
      console.error('Address validation failed:', error);
      throw error;
    }
  }

  async createShipment(shipmentData: ShipmentRequest): Promise<any> {
    try {
      const response = await this.makeRequest('/shipments/', 'POST', shipmentData);
      return response;
    } catch (error) {
      console.error('Shipment creation failed:', error);
      throw error;
    }
  }

  async getRates(fromAddress: ShippingAddress, toAddress: ShippingAddress): Promise<ShippingRate[]> {
    try {
      // Standard trading card package dimensions
      const defaultParcel = {
        length: '6',
        width: '4',
        height: '0.5',
        distance_unit: 'in',
        weight: '0.1',
        mass_unit: 'lb',
      };

      console.log("SHIPPO FROM ADDRESS: ",fromAddress)
      console.log("SHIPPO TO ADDRESS: ",toAddress)


       // Hardcoded test addresses
      //  const testFromAddress = {
      //   name: 'Mrs Hippo',
      //   street1: '1092 Indian Summer Ct',
      //   city: 'San Jose',
      //   state: 'CA',
      //   zip: '95122',
      //   country: 'US',
      //   phone: '4159876543',
      //   email: 'mrshippo@shippo.com'
      // };
      
      // const testFromAddress = {
      //   name: 'Mr. Hippo',
      //   street1: '215 Clayton St.',
      //   city: 'San Francisco',
      //   state: 'CA',
      //   zip: '94117',
      //   country: 'US',
      //   phone: '+1 555 341 9395',
      //   email: 'mr-hippo@goshippo.com'
      // };
  
      // const testToAddress = {
      //   name: 'Mr Hippo',
      //   street1: '965 Mission St #572',
      //   city: 'San Francisco',
      //   state: 'CA',
      //   zip: '94103',
      //   country: 'US',
      //   phone: '4151234567',
      //   email: 'mrhippo@shippo.com'
      // };
      // const testToAddress = {
      //   name: 'Mrs. Hippo',
      //   street1: '1092 Indian Summer Ct',
      //   city: 'San Francisco',
      //   state: 'CA',
      //   zip: '94107',
      //   country: 'US',
      //   phone: '+1 555 341 8395',
      //   email: 'mrs-hippo@goshippo.com'
      // };

    // console.log("USING HARDCODED TEST ADDRESSES");
    // console.log("FROM:", testFromAddress);
    // console.log("TO:", testToAddress);

      const shipment = await this.createShipment({
        // address_from: testFromAddress,
        // address_to: testToAddress,
        address_from: fromAddress,
        address_to: toAddress,
        parcels: [defaultParcel],
        async: false,
      });
      console.log("SHIPPO SHIPMENT: ",shipment)

      return shipment.rates || [];
    } catch (error) {
      console.error('Failed to get shipping rates:', error);
      throw error;
    }
  }

  async createShippingLabel(rateId: string): Promise<ShippingLabel> {
    try {
      const response = await this.makeRequest('/transactions/', 'POST', {
        rate: rateId,
        label_file_type: 'PDF',
        async: false,
      });
      return response;
    } catch (error) {
      console.error('Label creation failed:', error);
      throw error;
    }
  }

  async trackPackage(trackingNumber: string, carrier: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/tracks/${carrier}/${trackingNumber}/`);
      return response;
    } catch (error) {
      console.error('Package tracking failed:', error);
      throw error;
    }
  }

  // Helper method to get standard trading card shipping options
  async getStandardTradingCardRates(fromAddress: ShippingAddress, toAddress: ShippingAddress): Promise<ShippingRate[]> {
    const rates = await this.getRates(fromAddress, toAddress);
    
    try {
      // Filter for common trading card shipping methods
      const filteredRates = rates.filter(rate => {
        const serviceName = rate.servicelevel.name.toLowerCase();
        return serviceName.includes('first') || 
               serviceName.includes('priority') || 
               serviceName.includes('ground') ||
               serviceName.includes('standard');
      }).sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
      
      // If no suitable rates found, return all rates
      if (filteredRates.length === 0) {
        console.warn('No standard trading card rates found, returning all available rates');
        return rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
      }
      
      return filteredRates;
    } catch (error) {
      console.error('Error filtering rates:', error);
      // Return all rates as fallback
      return rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
    }
  }

  // Get tracking status for a package
  async getTrackingStatus(trackingNumber: string, carrier: string): Promise<any> {
    try {
      const response = await this.trackPackage(trackingNumber, carrier);
      return {
        status: response.tracking_status?.status || 'unknown',
        statusDetails: response.tracking_status?.status_details || 'No details available',
        lastUpdate: response.tracking_status?.status_date || null,
        eta: response.eta || null,
        trackingHistory: response.tracking_history || []
      };
    } catch (error) {
      console.error('Failed to get tracking status:', error);
      return {
        status: 'error',
        statusDetails: error instanceof Error ? error.message : 'Unknown error',
        lastUpdate: null,
        eta: null,
        trackingHistory: []
      };
    }
  }

  // Validate a tracking number format
  validateTrackingNumber(trackingNumber: string, carrier: string): boolean {
    if (!trackingNumber || !carrier) return false;
    
    // Basic validation patterns for common carriers
    const patterns: {[key: string]: RegExp} = {
      'usps': /^(94|93|92|94|95)[0-9]{17,21}$|^(EC|CP)[0-9]{9}US$|^[A-Z]{2}[0-9]{9}US$/i,
      'ups': /^1Z[0-9A-Z]{16}$|^(T|K|J)[0-9]{10}$/i,
      'fedex': /^[0-9]{12,14}$/i,
      'dhl': /^[0-9]{10,11}$/i
    };
    
    const pattern = patterns[carrier.toLowerCase()];
    if (!pattern) return true; // If carrier not in our patterns, assume valid
    
    return pattern.test(trackingNumber);
  }
}

export const shippoService = new ShippoService();
export type { ShippingAddress, ShippingRate, ShippingLabel };