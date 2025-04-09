import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { apiRequest } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Database, XCircle } from "lucide-react";

export default function DatabaseStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching database status...');
      // Use direct object for debugging instead of API call
      setStatus({
        status: "warning",
        connections: {
          categories: false,
          products: false
        },
        counts: {
          categories: 0,
          products: 0
        },
        env: {
          categoriesUrl: true,
          productsUrl: true
        },
        message: "Database appears to be empty or inaccessible. Please verify the database URLs are correct and that the databases contain data."
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch database status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Database Status</CardTitle>
          <CardDescription>Loading database status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="mr-2 h-5 w-5" />
          Database Status
        </CardTitle>
        <CardDescription>Information about the database connections</CardDescription>
      </CardHeader>
      <CardContent>
        {status ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Connection Status:</h3>
              <div className="flex gap-4">
                <div className="flex items-center">
                  <Badge variant={status.connections.categories ? "default" : "destructive"} className="mr-2">
                    {status.connections.categories ? (
                      <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-1" />
                    )}
                    Categories
                  </Badge>
                </div>
                <div className="flex items-center">
                  <Badge variant={status.connections.products ? "default" : "destructive"} className="mr-2">
                    {status.connections.products ? (
                      <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-1" />
                    )}
                    Products
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Record Counts:</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded">
                  <p className="text-sm font-medium">Categories:</p>
                  <p className="text-2xl font-bold">{status.counts.categories}</p>
                </div>
                <div className="bg-muted p-3 rounded">
                  <p className="text-sm font-medium">Products:</p>
                  <p className="text-2xl font-bold">{status.counts.products}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Environment Variables:</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded flex items-center">
                  <span className="text-sm font-medium mr-2">CATEGORIES_DB_URL:</span>
                  {status.env.categoriesUrl ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="bg-muted p-3 rounded flex items-center">
                  <span className="text-sm font-medium mr-2">PRODUCTS_DB_URL:</span>
                  {status.env.productsUrl ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            </div>
            
            {status.message && (
              <Alert className="mt-4 bg-amber-50 border-amber-500 text-amber-800">
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <Button onClick={fetchStatus} className="w-full">
              Refresh Status
            </Button>
          </div>
        ) : (
          <p>No data available</p>
        )}
      </CardContent>
    </Card>
  );
}