/**
 * Wallet sync helper
 * Auto-syncs wallet address when user connects wallet
 */

export async function syncWalletAddress(userId, walletAddress, apiUrl = 'http://localhost:5000') {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${apiUrl}/api/users/wallet-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ walletAddress })
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync wallet address');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Wallet sync error:', error);
    throw error;
  }
}
