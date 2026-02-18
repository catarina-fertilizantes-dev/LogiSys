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
        <CardHeader className="text-center pb-0">
          <div className="flex justify-center">
            <img 
              src="/nexor-auth-logo.png" 
              alt="NEXOR" 
              className="h-52 w-52 object-contain" 
            />
          </div>
          <CardTitle className="text-2xl font-bold -mt-2">NEXOR</CardTitle>
          <CardDescription className="-mt-1">Sistema de Gestão Logística</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">404</h1>
            <p className="text-lg text-muted-foreground">Página não encontrada</p>
            <p className="text-sm text-muted-foreground">
              A página que você está procurando não existe ou foi removida.
            </p>
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
