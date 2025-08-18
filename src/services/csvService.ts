// CSV Service for parsing and validating Pokémon card data
export interface CsvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data: any[];
}

export interface CsvParseOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  trimValues?: boolean;
  maxRows?: number;
}

export class CsvService {
  private static readonly REQUIRED_HEADERS = ['name'];
  private static readonly OPTIONAL_HEADERS = [
    'set', 'card_number', 'number', 'condition', 'quantity', 
    'list_type', 'type', 'market_price', 'price'
  ];
  
  private static readonly CONDITION_OPTIONS = [
    'Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 
    'Heavily Played', 'Damaged'
  ];

  // Parse CSV text into structured data
  static parseCsv(csvText: string, options: CsvParseOptions = {}): CsvValidationResult {
    const {
      delimiter = ',',
      skipEmptyLines = true,
      trimValues = true,
      maxRows = 1000
    } = options;

    try {
      const lines = csvText.split('\n');
      
      if (lines.length < 2) {
        return {
          isValid: false,
          errors: ['CSV file must contain at least a header row and one data row'],
          warnings: [],
          data: []
        };
      }

      // Parse headers
      const headerLine = lines[0];
      const headers = this.parseRow(headerLine, delimiter, trimValues);
      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

      // Validate headers
      const validation = this.validateHeaders(normalizedHeaders);
      if (!validation.isValid) {
        return validation;
      }

      // Parse data rows
      const data: any[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
        const line = lines[i];
        
        if (skipEmptyLines && !line.trim()) {
          continue;
        }

        try {
          const values = this.parseRow(line, delimiter, trimValues);
          const rowData = this.mapRowToObject(normalizedHeaders, values, i + 1);
          
          if (rowData.name) {
            data.push(rowData);
          } else {
            warnings.push(`Row ${i + 1}: Missing card name, skipping`);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
        }
      }

      if (lines.length > maxRows + 1) {
        warnings.push(`File contains more than ${maxRows} rows. Only the first ${maxRows} rows were processed.`);
      }

      return {
        isValid: data.length > 0,
        errors: data.length === 0 ? ['No valid card data found'] : errors,
        warnings,
        data
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        data: []
      };
    }
  }

  // Parse a single CSV row, handling quoted values
  private static parseRow(row: string, delimiter: string, trimValues: boolean): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < row.length) {
      const char = row[i];
      const nextChar = row[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        values.push(trimValues ? current.trim() : current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    values.push(trimValues ? current.trim() : current);
    return values;
  }

  // Validate CSV headers
  private static validateHeaders(headers: string[]): CsvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required headers
    const missingRequired = this.REQUIRED_HEADERS.filter(
      required => !headers.includes(required)
    );

    if (missingRequired.length > 0) {
      errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
    }

    // Check for unknown headers
    const allValidHeaders = [...this.REQUIRED_HEADERS, ...this.OPTIONAL_HEADERS];
    const unknownHeaders = headers.filter(
      header => !allValidHeaders.includes(header) && header.trim() !== ''
    );

    if (unknownHeaders.length > 0) {
      warnings.push(`Unknown columns will be ignored: ${unknownHeaders.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: []
    };
  }

  // Map CSV row values to card object
  private static mapRowToObject(headers: string[], values: string[], rowNumber: number): any {
    const obj: any = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      switch (header) {
        case 'name':
          obj.name = value;
          break;
        case 'set':
          obj.set = value || 'Unknown Set';
          break;
        case 'card_number':
        case 'number':
          obj.card_number = value;
          break;
        case 'condition':
          obj.condition = this.validateCondition(value);
          break;
        case 'quantity':
          obj.quantity = this.parsePositiveInteger(value, 1);
          break;
        case 'list_type':
        case 'type':
          obj.list_type = this.validateListType(value);
          break;
        case 'market_price':
        case 'price':
          obj.market_price = this.parsePrice(value);
          break;
      }
    });

    // Set defaults
    obj.set = obj.set || 'Unknown Set';
    obj.condition = obj.condition || 'Near Mint';
    obj.quantity = obj.quantity || 1;
    obj.list_type = obj.list_type || 'trade';

    return obj;
  }

  // Validate and normalize condition
  private static validateCondition(value: string): string {
    if (!value) return 'Near Mint';
    
    const normalized = value.trim();
    const found = this.CONDITION_OPTIONS.find(
      option => option.toLowerCase() === normalized.toLowerCase()
    );
    
    return found || 'Near Mint';
  }

  // Validate and normalize list type
  private static validateListType(value: string): 'trade' | 'want' {
    if (!value) return 'trade';
    
    const normalized = value.trim().toLowerCase();
    return (normalized === 'want' || normalized === 'wanted') ? 'want' : 'trade';
  }

  // Parse positive integer with default
  private static parsePositiveInteger(value: string, defaultValue: number): number {
    if (!value) return defaultValue;
    
    const parsed = parseInt(value.trim(), 10);
    return (isNaN(parsed) || parsed < 1) ? defaultValue : parsed;
  }

  // Parse price value
  private static parsePrice(value: string): number | undefined {
    if (!value) return undefined;
    
    // Remove currency symbols and whitespace
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    
    return (isNaN(parsed) || parsed < 0) ? undefined : parsed;
  }

  // Generate CSV template
  static generateTemplate(): string {
    const headers = [
      'name', 'set', 'card_number', 'condition', 'quantity', 'list_type', 'market_price'
    ];
    
    const examples = [
      ['Charizard', 'Base Set', '006', 'Near Mint', '1', 'trade', '350.00'],
      ['Pikachu', 'Base Set', '025', 'Lightly Played', '2', 'want', '25.00'],
      ['Blastoise', 'Base Set', '009', 'Near Mint', '1', 'trade', '280.00'],
      ['Venusaur', 'Base Set', '003', 'Near Mint', '1', 'want', '320.00']
    ];

    const rows = [headers, ...examples];
    return rows.map(row => row.join(',')).join('\n');
  }

  // Validate file before processing
  static validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return { isValid: false, error: 'File must be a CSV file (.csv extension)' };
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 5MB' };
    }

    // Check if file is empty
    if (file.size === 0) {
      return { isValid: false, error: 'File cannot be empty' };
    }

    return { isValid: true };
  }

  // Convert card data back to CSV format
  static exportToCsv(cards: any[]): string {
    if (cards.length === 0) {
      return this.generateTemplate();
    }

    const headers = ['name', 'set', 'card_number', 'condition', 'quantity', 'list_type', 'market_price'];
    
    const rows = [
      headers,
      ...cards.map(card => [
        card.name || '',
        card.set || '',
        card.card_number || '',
        card.condition || 'Near Mint',
        (card.quantity || 1).toString(),
        card.list_type || 'trade',
        card.market_price ? card.market_price.toFixed(2) : ''
      ])
    ];

    return rows.map(row => 
      row.map(cell => 
        // Quote cells that contain commas, quotes, or newlines
        /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(',')
    ).join('\n');
  }
}