import sys
import json
import urllib.request

def main():
    try:
        # Get args from the first command line argument
        args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        coin_id = args.get('coin_id', 'bitcoin').lower()
        
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd&include_24hr_change=true"
        
        req = urllib.request.Request(url, headers={'User-Agent': 'MikuCentral-Agent/1.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            
            if coin_id in data:
                price = data[coin_id]['usd']
                change = data[coin_id].get('usd_24h_change', 0)
                
                result = {
                    "coin": coin_id.capitalize(),
                    "price_usd": f"${price:,.2f}",
                    "change_24h": f"{change:+.2f}%",
                    "status": "success",
                    "message": f"The current price of {coin_id.capitalize()} is {price:,.2f} USD ({change:+.2f}% in the last 24h)."
                }
            else:
                result = {
                    "status": "error",
                    "message": f"Information for '{coin_id}' not found. Make sure to use the correct ID (e.g., 'bitcoin', 'ethereum')."
                }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "status": "error", 
            "message": f"Error connecting to the pricing API: {str(e)}"
        }))

if __name__ == "__main__":
    main()
