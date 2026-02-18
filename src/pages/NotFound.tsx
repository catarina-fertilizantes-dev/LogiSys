import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center items-center gap-2 mb-2">
            <img 
              src="/nexor-auth-logo.png" 
              alt="NEXOR" 
              className="h-8 w-8 object-contain" 
            />
            <span className="text-sm font-medium text-muted-foreground">NEXOR</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <AlertTriangle className="h-12 w-12 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-foreground">404</h1>
            <CardTitle className="text-xl">Página não encontrada</CardTitle>
            <CardDescription className="text-base">
              A página que você está procurando não existe ou foi removida.
            </CardDescription>
          </div>
          <Button 
            onClick={() => window.location.href = "/"} 
            className="w-full bg-gradient-primary max-md:min-h-[44px]"
          >
            <Home className="h-4 w-4 mr-2" />
            Voltar ao Início
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
