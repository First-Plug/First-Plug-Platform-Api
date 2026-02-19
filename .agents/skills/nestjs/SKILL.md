---
name: nestjs
description: NestJS framework expertise for building scalable server-side applications. Use when designing modules, services, controllers, dependency injection, decorators, middleware, guards, pipes, interceptors, and NestJS-specific patterns.
keywords: [nestjs, typescript, backend, modules, services, controllers, dependency-injection, decorators, guards, pipes, interceptors]
version: "1.0.0"
---

# NestJS Expertise

Specialized knowledge for building production-ready NestJS applications with best practices.

## When to Use This Skill

- Writing NestJS modules, controllers, or services
- Implementing authentication/authorization with guards
- Creating custom pipes, interceptors, or middleware
- Designing dependency injection patterns
- Building RESTful APIs with proper structure
- Implementing error handling and validation
- Working with decorators and metadata
- Optimizing performance and scalability

## Key Concepts

### Module Structure
- Organize code into feature modules
- Use `forwardRef()` for circular dependencies
- Properly export/import dependencies
- Lazy-load modules when appropriate

### Dependency Injection
- Constructor injection is preferred
- Use `@Inject()` for custom tokens
- Leverage provider scopes (Singleton, Request, Transient)
- Avoid circular dependencies

### Controllers & Routes
- Use `@Controller()` decorator with path prefix
- HTTP method decorators: `@Get()`, `@Post()`, `@Put()`, `@Delete()`
- Parameter decorators: `@Param()`, `@Query()`, `@Body()`
- Return proper HTTP status codes

### Services
- Keep business logic in services
- Services are singletons by default
- Inject dependencies via constructor
- Use async/await for async operations

### Guards, Pipes & Interceptors
- Guards: Authorization and authentication
- Pipes: Validation and transformation
- Interceptors: Cross-cutting concerns (logging, error handling)
- Apply at controller, method, or global level

### Error Handling
- Use `HttpException` and built-in exceptions
- Create custom exception filters
- Implement proper error responses
- Log errors appropriately

## Common Patterns

```typescript
// Module with proper structure
@Module({
  imports: [forwardRef(() => OtherModule)],
  controllers: [MyController],
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}

// Service with DI
@Injectable()
export class MyService {
  constructor(private readonly repo: Repository) {}
  
  async findAll() {
    return this.repo.find();
  }
}

// Controller with validation
@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}
  
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
```

## Best Practices

1. **Modular Design**: Keep modules focused and reusable
2. **Type Safety**: Use TypeScript strictly
3. **Validation**: Use class-validator and pipes
4. **Error Handling**: Implement proper exception filters
5. **Testing**: Write unit and integration tests
6. **Documentation**: Use Swagger/OpenAPI decorators
7. **Performance**: Optimize queries and use caching
8. **Security**: Validate inputs, use guards, sanitize data

