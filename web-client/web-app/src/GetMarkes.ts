export const getMarkers = async () => {
    const base = import.meta.env.VITE_API_URL;
    if (!base) throw new Error('VITE_API_URL is not set in .env')
    try {
        const response = await fetch(`${base}/stops`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        data.forEach(element => {
            element.coordinates = [element.lat, element.lng]
        });
        return data;
    } catch (error) {
        console.error('Error fetching markers:', error);
        // You might want to return an empty array or handle the error differently
        return [];
    }
};