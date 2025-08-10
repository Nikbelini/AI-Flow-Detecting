import {baseUrl} from './env'

export const getMarkers = async () => {
    try {
        const response = await fetch(`${baseUrl}/stops`);
        
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